import { FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { StatusBadge, toneForStatus } from "@/components/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionEmpty, SectionError, SectionFrame, SectionLoading } from "./section-ui";
import type { DeskModel } from "./use-desk";
import type { ModerationProjectItem } from "@/lib/api";

function localized(value: { en: string; ne?: string }, language: "en" | "ne") {
  return value[language] || value.en;
}
function statusLabel(t: Record<string, string>, status: string) {
  return t[`deskStatus${status.charAt(0).toUpperCase()}${status.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}`] ?? status;
}

function ProjectActions({ model, project }: { model: DeskModel; project: ModerationProjectItem }) {
  const status = model.projectStatus[project.id] || project.status;
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={() => model.setVerifyProjectId(project.id)}>
        {model.t.deskProjectsVerify}
      </Button>
      <Button size="sm" onClick={() => model.handleProject(project.id, { action: "publish" })} disabled={!project.committee.verified}>
        {model.t.deskProjectsPublish}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => {
          model.setProjectRejectId(project.id);
          model.setProjectRejectCode("");
          model.setProjectRejectDetail("");
        }}
      >
        {model.t.deskProjectsReject}
      </Button>
      <div className="flex min-w-0 gap-2">
        <NativeSelect
          aria-label={model.ds.deskProjectSetStatusConfirm}
          value={status}
          onChange={(event) => model.setProjectStatus((current) => ({ ...current, [project.id]: event.target.value }))}
        >
          {["pending", "published", "in-progress", "completed", "rejected", "archived"].map((value) => (
            <NativeSelectOption key={value} value={value}>
              {statusLabel(model.t, value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => model.handleProject(project.id, { action: "set-status", status: status as never })}
        >
          {model.t.deskProjectsSetStatus}
        </Button>
      </div>
    </div>
  );
}

function ProjectCard({ model, project }: { model: DeskModel; project: ModerationProjectItem }) {
  const pendingPhotos = project.pendingPhotos || project.photos.filter((photo) => photo.status === "pending");
  const pendingUpdates = project.pendingUpdates || (project.updates || []).filter((update) => update.status === "pending");
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>{localized(project.title, model.language)}</CardTitle>
          <StatusBadge tone={toneForStatus(project.status)}>{statusLabel(model.t, project.status)}</StatusBadge>
        </div>
        <CardDescription>
          {project.district} · W{project.ward} · {project.id}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap text-sm leading-6">{localized(project.description, model.language)}</p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            <strong>{model.ds.deskProjectType}:</strong> {project.type}
          </p>
          <p>
            <strong>{model.ds.deskProjectCost}:</strong> {project.costEstimateNpr}
          </p>
          <p>
            <strong>{model.ds.deskProjectLocation}:</strong> {project.locationText}
          </p>
        </div>
        <div className="rounded-lg border border-dashed bg-secondary p-4">
          <p className="text-xs font-semibold text-muted-foreground">{model.t.deskProjectsPrivateTitle}</p>
          <p className="mt-2 text-sm">
            {project.committee.name} · {project.committee.contactName} · {project.committee.phone}
          </p>
          {project.committee.email ? <p className="mt-1 text-xs">{project.committee.email}</p> : null}
        </div>
        <ProjectActions model={model} project={project} />
        {pendingPhotos.length ? (
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{model.t.deskProjectsPhotoPending}</h3>
            <div className="mt-3 grid gap-3">
              {pendingPhotos.map((photo) => (
                <div key={photo.fileId} className="flex flex-wrap items-center gap-3">
                  <img src={photo.url} alt={photo.caption || ""} className="size-16 rounded-md object-cover" loading="lazy" />
                  <span className="min-w-0 flex-1 text-sm">{photo.caption || photo.fileId}</span>
                  <Button size="sm" onClick={() => model.handleProject(project.id, { action: "publish-photo", fileId: photo.fileId })}>
                    {model.t.deskProjectsPhotoPublish}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => model.handleProject(project.id, { action: "reject-photo", fileId: photo.fileId })}
                  >
                    {model.t.deskProjectsPhotoReject}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {pendingUpdates.length ? (
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">{model.t.deskProjectsUpdatePending}</h3>
            <div className="mt-3 space-y-3">
              {pendingUpdates.map((update) => (
                <div key={update.id} className="rounded-lg bg-secondary p-3">
                  <p className="whitespace-pre-wrap text-sm">{update.text}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => model.handleProjectUpdate(project.id, update.id, "publish")}>
                      {model.t.deskProjectsUpdatePublish}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => model.handleProjectUpdate(project.id, update.id, "reject")}>
                      {model.t.deskProjectsUpdateReject}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function Projects({ model }: { model: DeskModel }) {
  return (
    <SectionFrame
      title={model.t.deskProjectsTitle}
      description={model.ds.deskProjectsDescription}
      refresh={model.loadProjects}
      refreshLabel={model.ds.deskRefresh}
    >
      {model.projectsLoading ? (
        <SectionLoading label={model.t.deskProjectsLoading} />
      ) : model.projectsError ? (
        <SectionError message={model.projectsError} retry={model.loadProjects} />
      ) : !model.projects.length ? (
        <SectionEmpty icon={FolderKanban} title={model.t.deskProjectsEmpty} />
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border bg-background md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{model.ds.deskTableItem}</TableHead>
                  <TableHead>{model.ds.deskTableStatus}</TableHead>
                  <TableHead>{model.ds.deskTableLocation}</TableHead>
                  <TableHead>{model.ds.deskTableCreated}</TableHead>
                  <TableHead>{model.ds.deskTableActions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell>
                      <p className="font-semibold">{localized(project.title, model.language)}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.type} · {project.committee.verified ? model.t.deskProjectsVerified : model.t.deskProjectsNotVerified}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={toneForStatus(project.status)}>{statusLabel(model.t, project.status)}</StatusBadge>
                    </TableCell>
                    <TableCell>
                      {project.district} · W{project.ward}
                    </TableCell>
                    <TableCell>{new Date(project.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <ProjectActions model={model} project={project} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="grid gap-4 md:hidden">
            {model.projects.map((project) => (
              <ProjectCard key={project.id} model={model} project={project} />
            ))}
          </div>
        </>
      )}
    </SectionFrame>
  );
}
