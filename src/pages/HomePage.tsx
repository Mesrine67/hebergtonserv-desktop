import { Link } from "react-router-dom";
import { ArrowUpRight, BookOpen, GitBranch, HardDrive, KeyRound, ServerCog, Settings2, ShieldCheck } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/page-shell";
import { Button } from "@/components/ui/button";

const sections = [
  { to: "/ssh-keys", title: "Identités SSH", summary: "Créer, importer et gérer des clés publiques et privées locales.", icon: KeyRound },
  { to: "/ssh-config", title: "Connexions SSH", summary: "Configurer les hôtes, vérifier leurs empreintes et organiser vos profils.", icon: HardDrive },
  { to: "/panels", title: "Panels d'hébergement", summary: "Connecter vos panels WISP et Pterodactyl à partir de clés API.", icon: ServerCog },
  { to: "/git", title: "Git / GitHub", summary: "Espace de développement prêt à accueillir les intégrations CLI et API.", icon: GitBranch },
] as const;

export default function HomePage() {
  return <div className="space-y-6">
    <PageHeader eyebrow="HÉBERGTONSERV DESKTOP" title="Accueil" description="Votre espace de gestion centralisé pour l'accès à distance et vos services d'hébergement." action={<Button asChild variant="outline"><Link to="/documentation"><BookOpen className="size-4" /> Documentation</Link></Button>} />
    <div className="grid gap-4 sm:grid-cols-2">
      {sections.map(({to,title,summary,icon:Icon}) => <Link key={to} to={to} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <SectionCard title={title} className="h-full transition-colors group-hover:border-primary/55">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="size-5" /></span>
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">{summary}</span>
            <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
        </SectionCard>
      </Link>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => window.dispatchEvent(new Event("hts:open-settings"))}><Settings2 className="size-4" /> Apparence et paramètres</Button>
      <Button variant="outline" onClick={() => window.dispatchEvent(new Event("hts:open-security"))}><ShieldCheck className="size-4" /> Sécurité</Button>
    </div>
  </div>;
}
