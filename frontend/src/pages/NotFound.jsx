import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-5xl">404</p>
      <p className="mt-3 text-slate-550">That page does not exist.</p>
      <Link to="/" className="mt-6 text-pine underline underline-offset-2">
        Back to the start
      </Link>
    </div>
  );
}
