import AuthErrorContent from '~/app/auth-error/error-content';
import { getServerAuthSession } from '~/server/auth';

export default async function AuthError() {
  const session = await getServerAuthSession();
  return <AuthErrorContent session={session} />;
}
