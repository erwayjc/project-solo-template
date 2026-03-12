// ---------------------------------------------------------------------------
// Goal Engine — autonomous multi-day goal pursuit via agent decomposition
// ---------------------------------------------------------------------------

import { createAdminClient } from '../src/lib/supabase/admin'
import { runAgentTask } from './task-runner'
import { log } from './logger'

export interface GoalEngineStatus {
  isRunning: boolean
  activeGoals: number
}

const MAX_DECOMPOSITION_ATTEMPTS = 3
const MAX_TASKS_PER_GOAL = 20
const MAX_RE_EVALUATION_TICKS = 30  // ~2.5 hours at 5-min intervals

export class GoalEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private tickCount = 0
  private adminUserId: string = ''
  private devAgentId: string = ''
  private decompositionAttempts = new Map<string, number>()
  private reEvalTicks = new Map<string, number>()

  async start(adminUserId: string) {
    this.adminUserId = adminUserId

    // Resolve the dev-agent (orchestrator) ID
    const admin = createAdminClient()
    const { data: devAgent } = await admin
      .from('agents')
      .select('id')
      .eq('slug', 'dev-agent')
      .single()

    if (!devAgent) {
      log('warn', 'goal-engine', 'Dev agent not found — goal engine will not decompose goals')
    } else {
      this.devAgentId = devAgent.id as string
    }

    this.intervalId = setInterval(() => this.tick(), 300_000) // Every 5 minutes
    log('info', 'goal-engine', 'Goal engine started')
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    log('info', 'goal-engine', 'Goal engine stopped')
  }

  getStatus(): GoalEngineStatus {
    return {
      isRunning: this.intervalId !== null,
      activeGoals: 0, // Updated in tick
    }
  }

  private async tick() {
    this.tickCount++
    const admin = createAdminClient()

    try {
      const { data: goals, error } = await admin
        .from('goals')
        .select('*')
        .eq('status', 'active')

      if (error) {
        log('error', 'goal-engine', 'Failed to fetch goals', { error: error.message })
        return
      }

      if (!goals || goals.length === 0) return

      for (const goal of goals) {
        try {
          await this.processGoal(goal, admin)
        } catch (err) {
          log('error', 'goal-engine', 'Goal processing failed', {
            goalId: goal.id,
            error: err instanceof Error ? err.message : 'Unknown',
          })
        }
      }
    } catch (err) {
      log('error', 'goal-engine', 'Goal engine tick failed', {
        error: err instanceof Error ? err.message : 'Unknown',
      })
    }
  }

  private async processGoal(
    goal: Record<string, unknown>,
    admin: ReturnType<typeof createAdminClient>
  ) {
    const goalId = goal.id as string

    // Load tasks for this goal
    const { data: tasks } = await admin
      .from('goal_tasks')
      .select('*')
      .eq('goal_id', goalId)
      .order('order_index')

    if (!tasks || tasks.length === 0) {
      // No tasks — decompose the goal (with attempt limit)
      const attempts = this.decompositionAttempts.get(goalId) ?? 0
      if (attempts >= MAX_DECOMPOSITION_ATTEMPTS) {
        await admin.from('goals').update({
          status: 'paused',
          strategy: `Auto-paused: decomposition failed after ${attempts} attempts`,
          updated_at: new Date().toISOString(),
        }).eq('id', goalId)
        log('error', 'goal-engine', 'Goal decomposition exceeded max attempts', { goalId, attempts })
        this.decompositionAttempts.delete(goalId)
        return
      }
      this.decompositionAttempts.set(goalId, attempts + 1)
      await this.decomposeGoal(goal, admin)
      return
    }

    // Check for consecutive failures (> 5 = auto-pause)
    let consecutiveFailures = 0
    for (let i = tasks.length - 1; i >= 0; i--) {
      if (tasks[i].status === 'failed') {
        consecutiveFailures++
      } else {
        break
      }
    }

    if (consecutiveFailures >= 5) {
      await admin
        .from('goals')
        .update({
          status: 'paused',
          strategy: `Auto-paused: ${consecutiveFailures} consecutive task failures`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', goalId)
      log('warn', 'goal-engine', 'Goal auto-paused due to consecutive failures', {
        goalId,
        consecutiveFailures,
      })
      return
    }

    // Find the first pending task
    const pendingTask = tasks.find((t) => t.status === 'pending')

    if (pendingTask) {
      // Execute one task per tick (prevent runaway)
      const taskAgentId = (pendingTask.agent_id as string) || this.devAgentId
      if (!taskAgentId) {
        log('warn', 'goal-engine', 'No agent assigned to task and no dev-agent available', {
          taskId: pendingTask.id,
        })
        return
      }

      // Mark task as in_progress
      await admin
        .from('goal_tasks')
        .update({ status: 'in_progress' })
        .eq('id', pendingTask.id)

      try {
        const result = await runAgentTask({
          agentId: taskAgentId,
          prompt: `Goal: ${goal.title}\n\nTask: ${pendingTask.title}\n${pendingTask.description || ''}`,
          triggerType: 'goal',
          triggerId: pendingTask.id as string,
          userId: this.adminUserId,
        })

        await admin
          .from('goal_tasks')
          .update({
            status: result.status === 'completed' ? 'completed' : 'failed',
            result: (result.response ?? '').substring(0, 5000),
            completed_at: new Date().toISOString(),
          })
          .eq('id', pendingTask.id)

        // Check if all tasks are now complete
        const { data: remaining } = await admin
          .from('goal_tasks')
          .select('id')
          .eq('goal_id', goalId)
          .in('status', ['pending', 'in_progress'])

        if (!remaining || remaining.length === 0) {
          await admin
            .from('goals')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', goalId)
          log('info', 'goal-engine', 'Goal completed', { goalId, title: goal.title })
        }
      } catch (err) {
        await admin
          .from('goal_tasks')
          .update({
            status: 'failed',
            result: err instanceof Error ? err.message : 'Unknown error',
          })
          .eq('id', pendingTask.id)
      }

      return
    }

    // All tasks completed/failed/skipped but goal not met — re-evaluate every 3rd tick
    // with a cap on total re-evaluation attempts to prevent runaway loops
    const reEvalCount = this.reEvalTicks.get(goalId) ?? 0
    if (reEvalCount >= MAX_RE_EVALUATION_TICKS) {
      await admin.from('goals').update({
        status: 'paused',
        strategy: `Auto-paused: re-evaluation limit reached (${reEvalCount} cycles)`,
        updated_at: new Date().toISOString(),
      }).eq('id', goalId)
      log('warn', 'goal-engine', 'Goal re-evaluation limit reached', { goalId, reEvalCount })
      this.reEvalTicks.delete(goalId)
      return
    }

    if (this.tickCount % 3 === 0 && this.devAgentId) {
      // Enforce task cap before creating new tasks
      const { count: taskCount } = await admin
        .from('goal_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('goal_id', goalId)

      if ((taskCount ?? 0) >= MAX_TASKS_PER_GOAL) {
        await admin.from('goals').update({
          status: 'paused',
          strategy: `Auto-paused: task limit reached (${taskCount}/${MAX_TASKS_PER_GOAL})`,
          updated_at: new Date().toISOString(),
        }).eq('id', goalId)
        log('warn', 'goal-engine', 'Goal task limit reached', { goalId, taskCount })
        return
      }

      this.reEvalTicks.set(goalId, reEvalCount + 1)
      const taskSummary = tasks
        .map((t) => `- [${t.status}] ${t.title}: ${(t.result as string)?.substring(0, 100) || 'no result'}`)
        .join('\n')

      await runAgentTask({
        agentId: this.devAgentId,
        prompt: `Re-evaluate goal progress and create new tasks if needed.\n\nGoal: ${goal.title}\nDescription: ${goal.description || ''}\nTarget: ${JSON.stringify(goal.target_metrics)}\n\nCompleted tasks:\n${taskSummary}\n\nCreate new tasks using create_goal_task if more work is needed, or use update_goal_progress to update metrics.`,
        triggerType: 'goal',
        triggerId: goalId,
        userId: this.adminUserId,
      })
    }
  }

  private async decomposeGoal(
    goal: Record<string, unknown>,
    admin: ReturnType<typeof createAdminClient>
  ) {
    const goalId = goal.id as string

    if (!this.devAgentId) {
      log('warn', 'goal-engine', 'Cannot decompose goal — no dev-agent', { goalId })
      return
    }

    log('info', 'goal-engine', 'Decomposing goal', { goalId, title: goal.title })

    await runAgentTask({
      agentId: this.devAgentId,
      prompt: `Decompose this goal into actionable tasks: ${goal.title} — ${goal.description || ''}. Target metrics: ${JSON.stringify(goal.target_metrics)}. Create tasks using the create_goal_task tool for goal ID "${goalId}". Each task should be specific, actionable, and assigned to the appropriate agent.`,
      triggerType: 'goal',
      triggerId: goalId,
      userId: this.adminUserId,
    })

    // Validate decomposition
    const { data: newTasks } = await admin
      .from('goal_tasks')
      .select('id')
      .eq('goal_id', goalId)

    if (!newTasks || newTasks.length === 0) {
      log('warn', 'goal-engine', 'Decomposition created no tasks, retrying', { goalId })

      await runAgentTask({
        agentId: this.devAgentId,
        prompt: `You MUST use the create_goal_task tool to create at least one task for goal ID "${goalId}". Goal: ${goal.title} — ${goal.description || ''}. Create specific, actionable tasks with agent assignments.`,
        triggerType: 'goal',
        triggerId: goalId,
        userId: this.adminUserId,
      })

      // Check again
      const { data: retryTasks } = await admin
        .from('goal_tasks')
        .select('id')
        .eq('goal_id', goalId)

      if (!retryTasks || retryTasks.length === 0) {
        await admin
          .from('goals')
          .update({
            status: 'paused',
            strategy: 'Decomposition failed — manual intervention required',
            updated_at: new Date().toISOString(),
          })
          .eq('id', goalId)
        log('error', 'goal-engine', 'Goal decomposition failed after retry', { goalId })
      }
    } else if (newTasks.length > MAX_TASKS_PER_GOAL) {
      // Delete excess tasks beyond the cap
      const excessIds = newTasks.slice(MAX_TASKS_PER_GOAL).map((t) => t.id as string)
      if (excessIds.length > 0) {
        await admin.from('goal_tasks').delete().in('id', excessIds)
      }
      log('warn', 'goal-engine', `Decomposition created ${newTasks.length} tasks, trimmed to ${MAX_TASKS_PER_GOAL}`, {
        goalId,
        removed: excessIds.length,
      })
    }
  }
}
