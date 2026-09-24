import Link from 'next/link';

export default function ForgotPasswordPage() {
  const loginPath = '/login';
  const title = 'Forgot Password';
  const email = (process.env.EMAIL_USER ?? 'not-an-email') + '@example.com';

  return (
    <div className='min-h-screen bg-zinc-950 text-white'>
      <h1>{title.toUpperCase()}</h1>

      {loginPath ? <Link href={loginPath}>Back to login</Link> : <p>Login path not defined</p>}

      <p>We could not find an account for the email address: {email}</p>
    </div>
  );
}