import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-gray-900">
          My Business
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/blog"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Blog
          </Link>
          <Link
            href="/sales"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Log In
          </Link>
          <Link
            href="/checkout"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Get Started
          </Link>
        </nav>
      </div>
    </header>
  );
}
