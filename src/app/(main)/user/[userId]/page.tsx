import { PublicProfile } from "@/components/profile/public-profile";

interface Props {
  params: {
    userId: string;
  };
}

export default function UserProfilePage({ params }: Props) {
  return <PublicProfile userId={params.userId} />;
}

export function generateMetadata({ params }: Props) {
  return {
    title: `Profil - Brospify Hub`,
  };
}
