#Requires -Version 5.1
<#
.SYNOPSIS
  Creates/reuses the HebergTonServ Desktop GitHub Project and imports open work.
.DESCRIPTION
  Safe to rerun. No deletions, merges, releases or secret storage.
  Requirements: GitHub CLI authenticated as an owner with "project" scope.
.EXAMPLE
  .\scripts\setup-github-project.ps1
.EXAMPLE
  .\scripts\setup-github-project.ps1 -ProjectNumber 3
#>
[CmdletBinding()]
param(
  [string]$Owner = 'Mesrine67',
  [string]$Repository = 'hebergtonserv-desktop',
  [string]$ProjectTitle = 'HébergTonServ Desktop - Roadmap',
  [int]$ProjectNumber = 0,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Invoke-GhJson {
  param([string[]]$Command)
  $output = & gh @Command
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI command failed: gh $($Command -join ' '). Check authentication and the 'project' scope (gh auth refresh -s project)."
  }
  $text = ($output | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }
  return ConvertFrom-Json -InputObject $text
}

function Invoke-GhCommand {
  param([string[]]$Command)
  & gh @Command
  if ($LASTEXITCODE -ne 0) {
    throw "GitHub CLI command failed: gh $($Command -join ' ')"
  }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI 'gh' is required: https://cli.github.com/"
}
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
  throw 'Sign in with gh auth login, then grant project scope using gh auth refresh -s project.'
}

$fullRepo = "$Owner/$Repository"
$created = $false

if ($ProjectNumber -le 0) {
  $projectResponse = Invoke-GhJson -Command @('project','list','--owner',$Owner,'--limit','100','--format','json')
  $projects = @($projectResponse.projects)
  $matches = @($projects | Where-Object {
    $_.title -eq $ProjectTitle -or $_.title -match '(?i)hebergtonserv.*desktop|desktop.*hebergtonserv'
  })
  if ($matches.Count -gt 1) {
    throw "Multiple candidate Projects exist. Rerun with -ProjectNumber <number>, after checking the correct project."
  }
  if ($matches.Count -eq 1) {
    $ProjectNumber = [int]$matches[0].number
    Write-Host "Reusing project #$ProjectNumber : $($matches[0].title)"
  } elseif ($DryRun) {
    Write-Host "[DRY RUN] Would create '$ProjectTitle' under $Owner"
    return
  } else {
    $project = Invoke-GhJson -Command @('project','create','--owner',$Owner,'--title',$ProjectTitle,'--format','json')
    $ProjectNumber = [int]$project.number
    $created = $true
    Write-Host "Created project #$ProjectNumber"
  }
}

$project = Invoke-GhJson -Command @('project','view',"$ProjectNumber",'--owner',$Owner,'--format','json')
Write-Host "Project: $($project.url)"

if ($DryRun) {
  Write-Host '[DRY RUN] Would link repository, create missing fields, and import open issues/PRs.'
  return
}

# Link the repository. A link error is reported, not silently swallowed.
# A previously linked repository may cause an "already linked" response.
$linkOutput = & gh project link "$ProjectNumber" --owner $Owner --repo $fullRepo 2>&1
if ($LASTEXITCODE -ne 0) {
  $message = ($linkOutput | Out-String).Trim()
  if ($message -notmatch '(?i)already.*link|already.*connected') {
    Write-Warning "Could not link project to repository: $message. Verify the link in GitHub Projects."
  }
}

if ($created) {
  $description = 'Suivi des bugs, securite, CI/CD, fonctionnalites SSH et integrations Wisp/Pterodactyl. Corrections via PR relues avant fusion.'
  $readme = @'
# HebergTonServ Desktop - Roadmap

**Objectif** : centraliser les issues et pull requests du depot.

## Workflow
- Todo : issue qualifiee, en attente.
- In Progress : branche ou correctif en preparation.
- Done : uniquement apres validation et cloture/merge.

## Regles de livraison
- Une PR par sujet, sauf couplage technique justifie.
- Ne jamais deposer de token, cle SSH privee ou cle de signature.
- Verifier TypeScript, lint, tests, Vite, cargo fmt, clippy et tests Rust.
- Ne pas publier de release avant une CI verte et des mises a jour Tauri signees.
- Les priorites P0 bloquent avant P1, puis P2.
'@
  Invoke-GhCommand -Command @('project','edit',"$ProjectNumber",'--owner',$Owner,'--description',$description,'--readme',$readme)
}

$fieldResponse = Invoke-GhJson -Command @('project','field-list',"$ProjectNumber",'--owner',$Owner,'--limit','100','--format','json')
$fields = @($fieldResponse.fields)

if (@($fields | Where-Object { $_.name -eq 'Priorite' }).Count -eq 0) {
  [void](Invoke-GhJson -Command @('project','field-create',"$ProjectNumber",'--owner',$Owner,'--name','Priorite','--data-type','SINGLE_SELECT','--single-select-options','P0,P1,P2,P3','--format','json'))
  Write-Host 'Created Priorite field'
}
if (@($fields | Where-Object { $_.name -eq 'Domaine' }).Count -eq 0) {
  [void](Invoke-GhJson -Command @('project','field-create',"$ProjectNumber",'--owner',$Owner,'--name','Domaine','--data-type','SINGLE_SELECT','--single-select-options','CI,Panels,SSH,Windows,Security,Release,Other','--format','json'))
  Write-Host 'Created Domaine field'
}
# Refresh field IDs and options after creation.
$fieldResponse = Invoke-GhJson -Command @('project','field-list',"$ProjectNumber",'--owner',$Owner,'--limit','100','--format','json')
$fields = @($fieldResponse.fields)

$existingResponse = Invoke-GhJson -Command @('project','item-list',"$ProjectNumber",'--owner',$Owner,'--limit','1000','--format','json')
$knownUrls = @{}
foreach ($existing in @($existingResponse.items)) {
  if ($null -ne $existing.content -and -not [string]::IsNullOrWhiteSpace($existing.content.url)) {
    $knownUrls[$existing.content.url.TrimEnd('/')] = $true
  }
}

$issues = @(Invoke-GhJson -Command @('issue','list','--repo',$fullRepo,'--state','open','--limit','200','--json','url,number,title'))
$pulls = @(Invoke-GhJson -Command @('pr','list','--repo',$fullRepo,'--state','open','--limit','200','--json','url,number,title'))

$priorityByNumber = @{
  'issue/8' = 'P0'; 'issue/13' = 'P0'; 'issue/16' = 'P0'
  'issue/9' = 'P1'; 'issue/14' = 'P1'; 'issue/15' = 'P1'
  'issue/17' = 'P1'; 'issue/5' = 'P1'
  'issue/1' = 'P2'; 'issue/2' = 'P2'; 'issue/3' = 'P2'; 'issue/4' = 'P2'
  'pull/12' = 'P0'
}
$areaByNumber = @{
  'issue/1' = 'Windows'; 'issue/2' = 'Windows'
  'issue/3' = 'Panels'; 'issue/4' = 'SSH'; 'issue/5' = 'SSH'
  'issue/8' = 'CI'; 'issue/9' = 'Release'
  'issue/13' = 'Panels'; 'issue/14' = 'SSH'; 'issue/15' = 'Windows'
  'issue/16' = 'Security'; 'issue/17' = 'Release'
  'pull/12' = 'CI'
}

$entries = @()
foreach ($issue in $issues) {
  if ($null -ne $issue) { $entries += [pscustomobject]@{url=$issue.url;key="issue/$($issue.number)"} }
}
foreach ($pull in $pulls) {
  if ($null -ne $pull) { $entries += [pscustomobject]@{url=$pull.url;key="pull/$($pull.number)"} }
}

$added = 0
$skipped = 0
foreach ($entry in $entries) {
  $url = [string]$entry.url
  if ([string]::IsNullOrWhiteSpace($url)) { continue }
  $normalized = $url.TrimEnd('/')
  $newItem = -not $knownUrls.ContainsKey($normalized)
  if ($newItem) {
    $addedItem = Invoke-GhJson -Command @('project','item-add',"$ProjectNumber",'--owner',$Owner,'--url',$url,'--format','json')
    $knownUrls[$normalized] = $true
    $added++

    # GitHub CLI requires GraphQL IDs for item-edit, not URLs or field names.
    $itemId = [string]$addedItem.id
    $projectId = [string]$project.id
    foreach ($assignment in @(
      [pscustomobject]@{ field='Priorite'; value=$priorityByNumber[$entry.key] },
      [pscustomobject]@{ field='Domaine'; value=$areaByNumber[$entry.key] }
    )) {
      if ([string]::IsNullOrWhiteSpace([string]$assignment.value)) { continue }
      $field = @($fields | Where-Object { $_.name -eq $assignment.field }) | Select-Object -First 1
      if ($null -eq $field) { throw "Field not found: $($assignment.field)" }
      $option = @($field.options | Where-Object { $_.name -eq $assignment.value }) | Select-Object -First 1
      if ($null -eq $option) { throw "Field option not found: $($assignment.field) / $($assignment.value)" }
      Invoke-GhCommand -Command @('project','item-edit','--id',$itemId,'--project-id',$projectId,'--field-id',[string]$field.id,'--single-select-option-id',[string]$option.id)
    }
  } else { $skipped++ }
}

Write-Host "Project board: $($project.url)"
Write-Host "New items: $added; already present: $skipped"
Write-Host 'In GitHub, choose/create a Board view grouped by Status. Configure built-in workflows for closed issues and merged PRs.'
