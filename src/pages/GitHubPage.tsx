import { GitBranch, GitPullRequest, LockKeyhole } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/page-shell";

export default function GitHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="DÉVELOPPEMENT" title="Git / GitHub"
        description="Un espace pour vos dépôts locaux et vos futurs projets GitHub." />
      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Git local" description="Branches, commits et synchronisation">
          <div className="flex gap-2 text-sm text-muted-foreground">
            <GitBranch className="size-4 shrink-0 text-primary" />
            L’intégration Git CLI n’est pas encore activée. Aucune commande n’est exécutée sur cet écran.
          </div>
        </SectionCard>
        <SectionCard title="GitHub" description="Dépôts, issues et pull requests">
          <div className="flex gap-2 text-sm text-muted-foreground">
            <GitPullRequest className="size-4 shrink-0 text-primary" />
            <span>Connexion GitHub à venir : <GitPullRequest className="inline size-4" /> PR et issues.</span>
          </div>
        </SectionCard>
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-4" /> Aucun jeton ni autorisation GitHub n’est demandé pour l’instant.</p>
    </div>
  );
}
