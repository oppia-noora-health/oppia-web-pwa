import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication
const protectedRoutes = ["/course", "/dashboard", "/profile"];

// Routes that should redirect to course page if already authenticated
const authRoutes = ["/login", "/verify-otp"];

// Public routes that don't require authentication
const publicRoutes = ["/", "/coming-soon", "/privacy-policy"];

/**
 * Proxy function to handle authentication and route protection
 * Runs before each request is completed
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if user has auth data in cookie
  const authCookie = request.cookies.get("auth-storage");

  let isAuthenticated = false;
  if (authCookie?.value) {
    try {
      // Decode the cookie value if it's URL encoded
      const decodedValue = decodeURIComponent(authCookie.value);
      const authData = JSON.parse(decodedValue);

      // Check if user exists and has required fields
      isAuthenticated = !!(
        authData?.state?.user?.apiKey &&
        authData?.state?.user?.username &&
        authData?.state?.isAuthenticated
      );
    } catch (error) {
      isAuthenticated = false;
    }
  }

  // Protect routes that require authentication
  if (protectedRoutes.some((route) => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      const url = new URL("/login", request.url);
      // Add redirect parameter to return user to intended page after login
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  }

  // Redirect to course page if already authenticated and trying to access auth pages
  if (authRoutes.some((route) => pathname.startsWith(route))) {
    if (isAuthenticated) {
      const url = new URL("/course", request.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

// Configuration for path matching
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)"],
};
