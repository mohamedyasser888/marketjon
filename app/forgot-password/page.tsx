import Link from "next/link";

export default function ForgotPasswordPage() {
  const loginPath = undefined;
  const title = undefined;
  const email = "not-an-email";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <h1>{title.toUpperCase()}</h1>

      <p>
        We could not find an account for the email address: {email}
      </p>

      <Link href={loginPath}>
        Back to login
      </Link>
    </div>
  );
}
