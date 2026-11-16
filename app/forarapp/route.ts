export function GET(request: Request) {
  const destination = new URL("/driver?install=1", request.url);
  return Response.redirect(destination, 302);
}
