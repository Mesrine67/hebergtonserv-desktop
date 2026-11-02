import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, Search } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isTauri } from "@tauri-apps/api/core";

const articles = [
  { section: "Démarrage", title: "Premiers pas", text: "Ouvrez l'application, terminez l'écran de bienvenue, puis utilisez la barre latérale. Le bouton Maison ouvre l'accueil. Les préférences d'affichage sont disponibles dans Paramètres.", link: "" },
  { section: "SSH", title: "Clés SSH", text: "Dans Clés SSH, générez une paire Ed25519 ou importez uniquement une clé publique. Ne transmettez jamais votre clé privée. Une phrase de passe protège son utilisation.", link: "" },
  { section: "SSH", title: "Configuration et hôtes", text: "Ajoutez un alias et un hôte dans Configuration SSH. Avant d'approuver une empreinte SHA256, vérifiez-la par une source indépendante de confiance.", link: "" },
  { section: "Panels", title: "WISP et Pterodactyl", text: "Ajoutez une URL HTTPS et une clé API Client depuis Panels. WISP API v1 est le choix documenté par défaut. Pterodactyl 2.x utilise application/json. Les clés sont stockées dans le coffre Windows.", link: "" },
  { section: "Application", title: "Mises à jour", text: "La vérification des mises à jour utilise un manifeste signé GitHub latest.json. Utilisez la commande dans Aide ou les Paramètres, puis vérifiez la version et la provenance avant l'installation.", link: "" },
  { section: "Application", title: "Thèmes et raccourcis", text: "Personnalisez votre style, base et accentuation dans Paramètres. Alt + flèches permet le retour ou l'avance ; Ctrl + B replie la navigation. Les animations réduites respectent la préférence système.", link: "" },
  { section: "Développement", title: "Git / GitHub", text: "La section Git/GH est actuellement un espace préparatoire. Aucune opération Git ou GitHub n'est lancée depuis cette page tant que l'intégration et les autorisations ne sont pas configurées.", link: "" },
  { section: "Référence", title: "Projet et assistance", text: "Consultez le référentiel du projet pour les notes de version, les rapports de problèmes et les détails d'implémentation.", link: "https://github.com/Mesrine67/hebergtonserv-desktop" },
];
export default function DocumentationPage() {
 const [search, setSearch] = useState("");
 const filtered = useMemo(() => articles.filter(x => [x.title,x.section,x.text].join(" ").toLocaleLowerCase("fr").includes(search.trim().toLocaleLowerCase("fr"))),[search]);
 return <div className="space-y-6">
  <PageHeader eyebrow="CENTRE D'AIDE" title="Documentation" description="Retrouvez les principaux guides directement dans HébergTonServ Desktop." />
  <label className="relative block max-w-xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Rechercher dans la documentation</span><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un guide..." className="pl-9"/></label>
  <div className="grid gap-4 lg:grid-cols-2">{filtered.map(x=><SectionCard key={x.title} title={x.title} description={x.section}><p className="text-sm leading-6 text-muted-foreground">{x.text}</p>{x.link&&<Button className="mt-3" variant="outline" size="sm" onClick={()=>{if(isTauri())void openUrl(x.link);else window.open(x.link,"_blank","noopener,noreferrer");}}><ExternalLink className="size-3.5"/> Référentiel GitHub</Button>}</SectionCard>)}</div>
  {!filtered.length&&<div role="status" className="rounded-lg border border-dashed p-8 text-center text-muted-foreground"><BookOpen className="mx-auto mb-2 size-7" /> Aucun guide ne correspond à cette recherche.</div>}
 </div>;
}
