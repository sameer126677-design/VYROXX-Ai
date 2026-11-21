import React, { useMemo, useState } from 'react';
import {
  Search,
  LayoutGrid,
  List,
  MoreVertical,
  FolderOpen,
  Pencil,
  Star,
  Download,
  Archive,
  Trash2,
  RotateCcw,
  Plus,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { AnimationScenePlan } from '../shared/sceneSchema';
import { ProjectRecord } from '../types';
import { ProjectThumbnailCanvas } from './AnimationCanvas';

interface ProjectsViewProps {
  projects: ProjectRecord[];
  loading: boolean;
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
  onRenameProject: (project: ProjectRecord) => void;
  onToggleFavorite: (projectId: string, nextFav: boolean) => void;
  onDownloadProject: (scenePlan: AnimationScenePlan, projectTitle: string) => void;
  onToggleArchive: (projectId: string, nextArchived: boolean) => void;
  onDeleteProject: (project: ProjectRecord) => void;
  onRecoverProject: (projectId: string) => void;
  onPermanentDeleteProject: (project: ProjectRecord) => void;
}

type CategoryFilter = 'all' | 'favorited' | 'archived' | 'trash';
type SortOption = 'edited' | 'created' | 'alpha';

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  projects,
  loading,
  onOpenProject,
  onNewProject,
  onRenameProject,
  onToggleFavorite,
  onDownloadProject,
  onToggleArchive,
  onDeleteProject,
  onRecoverProject,
  onPermanentDeleteProject,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('edited');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const activeProjectsCount = projects.filter((p) => !p.deletedAt && !p.archived).length;
  const trashCount = projects.filter((p) => Boolean(p.deletedAt)).length;

  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (activeCategory === 'trash') return Boolean(p.deletedAt);
        if (p.deletedAt) return false;
        if (activeCategory === 'archived') return p.archived;
        if (p.archived) return false;
        if (activeCategory === 'favorited') return p.favorite;
        return true;
      })
      .filter((p) => p.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
      .sort((a, b) => {
        if (sortBy === 'edited') return b.updatedAtMs - a.updatedAtMs;
        if (sortBy === 'created') return b.createdAtMs - a.createdAtMs;
        return a.title.localeCompare(b.title);
      });
  }, [projects, activeCategory, searchQuery, sortBy]);

  return (
    <div
      className="min-h-full w-full px-6 sm:px-10 py-8 flex flex-col"
      onClick={() => setOpenMenuId(null)}
    >
      <div className="flex flex-wrap items-center justify-between gap-6 mb-7 pr-14">
        <div className="flex flex-wrap items-center gap-6">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight vyroxx-heading-metallic">
            My Projects
          </h1>

          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Cloud Firestore Synced</span>
            </div>
            <span className="text-xs text-slate-400 pl-5">User-Isolated Storage</span>
          </div>
        </div>

        <div className="relative flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl vyroxx-glass-subtle border border-slate-400/20">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeCategory === 'all'
                ? 'bg-slate-800/90 text-white border border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Projects ({activeProjectsCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('favorited')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeCategory === 'favorited'
                ? 'bg-slate-800/90 text-white border border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Favorites
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('trash')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              activeCategory === 'trash'
                ? 'bg-slate-800/90 text-white border border-cyan-400/40 shadow-[0_0_16px_rgba(56,189,248,0.2)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Recently Deleted ({trashCount})</span>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search, Sort & View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your projects..."
            className="w-full pl-10 pr-4 py-2 rounded-xl vyroxx-input text-xs sm:text-sm placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3.5 py-2 rounded-xl vyroxx-input text-xs sm:text-sm text-slate-200 cursor-pointer"
          >
            <option value="edited" className="bg-slate-900">
              Sort: Recently Edited
            </option>
            <option value="created" className="bg-slate-900">
              Sort: Recently Created
            </option>
            <option value="alpha" className="bg-slate-900">
              Sort: Alphabetical
            </option>
          </select>

          <div className="flex items-center p-1 rounded-xl vyroxx-glass-subtle">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'grid' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="List View"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl vyroxx-btn-primary text-xs sm:text-sm cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Main Split: Left Category Nav + Right Grid */}
      <div className="flex-1 flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-52 shrink-0 space-y-1.5">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeCategory === 'all'
                ? 'vyroxx-glass text-white border border-sky-300/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            All Projects
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('favorited')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeCategory === 'favorited'
                ? 'vyroxx-glass text-white border border-sky-300/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Favorited
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('trash')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeCategory === 'trash'
                ? 'vyroxx-glass text-white border border-sky-300/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Trash &amp; Recovery ({trashCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('archived')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeCategory === 'archived'
                ? 'vyroxx-glass text-white border border-sky-300/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Archived
          </button>
        </aside>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
              <span>Loading your projects from Firestore...</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-2xl vyroxx-glass p-12 text-center max-w-xl mx-auto my-6">
              <FolderOpen className="w-10 h-10 text-cyan-400 mx-auto mb-3 opacity-80" />
              <h3 className="text-lg font-medium text-white mb-1">
                {activeCategory === 'trash'
                  ? 'Trash is empty'
                  : searchQuery
                  ? 'No matching projects'
                  : 'No projects yet'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mb-6">
                {activeCategory === 'trash'
                  ? 'Deleted projects will appear here for recovery.'
                  : 'Describe your first AI animation from the Home prompt bar to start creating.'}
              </p>
              {activeCategory !== 'trash' && (
                <button
                  type="button"
                  onClick={onNewProject}
                  className="px-5 py-2.5 rounded-xl vyroxx-btn-primary text-xs sm:text-sm cursor-pointer"
                >
                  Create First Animation
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredProjects.map((proj) => {
                const isHovered = hoveredCardId === proj.id;
                const isMenuOpen = openMenuId === proj.id;

                return (
                  <div
                    key={proj.id}
                    onMouseEnter={() => setHoveredCardId(proj.id)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    onClick={() => {
                      if (!proj.deletedAt) onOpenProject(proj.id);
                    }}
                    className={`relative rounded-2xl p-3.5 transition-all cursor-pointer ${
                      isHovered
                        ? 'vyroxx-glass vyroxx-card-active'
                        : 'vyroxx-glass hover:border-cyan-400/40'
                    }`}
                  >
                    <div className="relative rounded-xl overflow-hidden aspect-[16/9] bg-slate-950 mb-3.5">
                      <ProjectThumbnailCanvas scenePlan={proj.latestScenePlan} />

                      <div className="absolute top-3 right-3 z-10">
                        {proj.status === 'completed' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/85 border border-emerald-400/40 text-xs font-medium text-emerald-200 backdrop-blur-md">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Completed</span>
                          </div>
                        )}
                        {proj.status === 'generating' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/85 border border-sky-400/50 text-xs font-medium text-sky-200 backdrop-blur-md">
                            <Loader2 className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                            <span>Generating</span>
                          </div>
                        )}
                        {proj.status === 'failed' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/85 border border-rose-400/50 text-xs font-medium text-rose-200 backdrop-blur-md">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                            <span>Failed</span>
                          </div>
                        )}
                        {proj.status === 'idle' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/85 border border-white/15 text-xs font-medium text-slate-300 backdrop-blur-md">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>Draft</span>
                          </div>
                        )}
                      </div>

                      {proj.favorite && (
                        <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-slate-950/75 border border-amber-400/40 flex items-center justify-center text-amber-400">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                        </div>
                      )}

                      {isHovered && !proj.deletedAt && !isMenuOpen && (
                        <div className="absolute right-4 bottom-4 max-w-[270px] rounded-xl p-3.5 bg-slate-900/95 border border-cyan-300/35 shadow-[0_15px_35px_rgba(0,0,0,0.75)] backdrop-blur-md pointer-events-none">
                          <div className="text-sm font-medium text-white mb-0.5">
                            Open Workspace
                          </div>
                          <div className="text-xs text-slate-300/90 leading-snug">
                            Click to resume your saved AI conversation &amp; animations
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 px-1">
                      <div className="min-w-0">
                        <h3 className="text-base sm:text-lg font-medium text-slate-100 truncate">
                          {proj.title}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span>{proj.versionCount} version{proj.versionCount === 1 ? '' : 's'}</span>
                          <span aria-hidden="true">·</span>
                          <span>last modified {proj.lastModifiedLabel}</span>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-2 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {proj.deletedAt ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onRecoverProject(proj.id)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-xs font-medium text-emerald-200 cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Recover</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onPermanentDeleteProject(proj)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-xs font-medium text-rose-200 cursor-pointer"
                              title="Permanently Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(isMenuOpen ? null : proj.id)}
                              className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                              title="Project Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {isMenuOpen && (
                              <div className="absolute right-0 bottom-full mb-2 w-48 rounded-xl vyroxx-glass p-1.5 z-30 shadow-2xl border border-cyan-300/30">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onOpenProject(proj.id);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                                >
                                  <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Open Workspace</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onRenameProject(proj);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-slate-300" />
                                  <span>Rename</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onToggleFavorite(proj.id, !proj.favorite);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                                >
                                  <Star className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{proj.favorite ? 'Unfavorite' : 'Favorite'}</span>
                                </button>
                                {proj.latestScenePlan && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      onDownloadProject(proj.latestScenePlan!, proj.title);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5 text-slate-300" />
                                    <span>Export Video / GIF</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onToggleArchive(proj.id, !proj.archived);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                                >
                                  <Archive className="w-3.5 h-3.5 text-slate-300" />
                                  <span>
                                    {proj.archived ? 'Restore from Archive' : 'Move to Archive'}
                                  </span>
                                </button>
                                <div className="my-1 border-t border-white/10" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    onDeleteProject(proj);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/20 hover:text-rose-200 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredProjects.map((proj) => (
                <div
                  key={proj.id}
                  onClick={() => {
                    if (!proj.deletedAt) onOpenProject(proj.id);
                  }}
                  className="rounded-2xl vyroxx-glass p-3.5 flex items-center justify-between gap-4 hover:border-cyan-400/45 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-28 aspect-[16/9] rounded-lg overflow-hidden shrink-0">
                      <ProjectThumbnailCanvas scenePlan={proj.latestScenePlan} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-medium text-white truncate">{proj.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                        <span className="capitalize">{proj.status}</span>
                        <span aria-hidden="true">·</span>
                        <span>Last modified {proj.lastModifiedLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{proj.versionCount} version{proj.versionCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {proj.deletedAt ? (
                      <button
                        type="button"
                        onClick={() => onRecoverProject(proj.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-200 text-xs font-medium cursor-pointer"
                      >
                        Recover
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenProject(proj.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs font-medium text-cyan-200 cursor-pointer"
                        >
                          Open Workspace
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProject(proj)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
