import React, { useMemo, useState } from 'react';
import {
  Plus,
  Search,
  MoreVertical,
  Pencil,
  RefreshCw,
  Download,
  Star,
  Trash2,
  Eye,
  FolderPlus,
  Loader2,
  ScanLine,
} from 'lucide-react';
import { AssetCategory, AssetRecord } from '../types';
import { AuthenticatedAssetThumbnail } from './AnimationCanvas';
import { CharacterRigStudio } from './CharacterRigStudio';

interface AssetsViewProps {
  assets: AssetRecord[];
  loading: boolean;
  onOpenUploadModal: () => void;
  onPreviewAsset: (asset: AssetRecord) => void;
  onRenameAsset: (asset: AssetRecord) => void;
  onReuseInProject: (asset: AssetRecord) => void;
  onDownloadAsset: (asset: AssetRecord) => void;
  onToggleFavoriteAsset: (assetId: string, nextFav: boolean) => void;
  onDeleteAsset: (asset: AssetRecord) => void;
}

const ASSET_CATEGORIES: {
  id: 'All' | AssetCategory;
  label: string;
  subtitle?: string;
}[] = [
  { id: 'All', label: 'All Assets' },
  { id: 'Characters', label: 'Characters', subtitle: '(character designs)' },
  { id: 'Backgrounds', label: 'Backgrounds', subtitle: '(cities, nature, environments)' },
  { id: 'Props', label: 'Props', subtitle: '(cars, weapons, objects)' },
  { id: 'Images', label: 'Images', subtitle: '(PNG, JPG, WebP, SVG)' },
  { id: 'Videos', label: 'Videos', subtitle: '(MP4, WebM, MOV)' },
  { id: 'Audio', label: 'Audio', subtitle: '(MP3, WAV, OGG)' },
  { id: 'Other Files', label: 'Other Files', subtitle: '(JSON, TXT, PDF)' },
];

export const AssetsView: React.FC<AssetsViewProps> = ({
  assets,
  loading,
  onOpenUploadModal,
  onPreviewAsset,
  onRenameAsset,
  onReuseInProject,
  onDownloadAsset,
  onToggleFavoriteAsset,
  onDeleteAsset,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | AssetCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [rigAsset, setRigAsset] = useState<AssetRecord | null>(null);

  const filteredAssets = useMemo(() => {
    return assets
      .filter((a) => (selectedCategory === 'All' ? true : a.category === selectedCategory))
      .filter((a) => a.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  }, [assets, selectedCategory, searchQuery]);

  return (
    <div
      className="min-h-full w-full px-6 sm:px-10 py-8 flex flex-col"
      onClick={() => setActiveMenuId(null)}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pr-14">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight vyroxx-heading-metallic">
            My Assets
          </h1>

          <div className="px-4 py-1.5 rounded-xl vyroxx-glass-subtle border border-white/10 text-xs sm:text-sm text-slate-300 font-mono-tabular">
            <span className="font-semibold text-white">{assets.length}</span> Total Items
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 text-white text-xs sm:text-sm font-medium shadow-[0_0_24px_rgba(56,189,248,0.4)] hover:brightness-110 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Upload Asset</span>
          </button>

          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl vyroxx-input text-xs sm:text-sm placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8">
        <aside className="w-full lg:w-56 shrink-0 space-y-1">
          <div className="px-3 pb-2 text-xs font-medium text-slate-400">Categories</div>
          {ASSET_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                  isActive
                    ? 'vyroxx-glass text-white border border-sky-300/30 shadow-[0_0_18px_rgba(56,189,248,0.15)]'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <div className="text-sm font-medium leading-snug">{cat.label}</div>
                {cat.subtitle && (
                  <div className="text-xs text-slate-400 font-normal leading-tight mt-0.5">
                    {cat.subtitle}
                  </div>
                )}
              </button>
            );
          })}
        </aside>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400 text-sm">
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
              <span>Loading your assets...</span>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="rounded-2xl vyroxx-glass p-12 text-center max-w-xl mx-auto my-6">
              <FolderPlus className="w-10 h-10 text-cyan-400 mx-auto mb-3 opacity-80" />
              <h3 className="text-lg font-medium text-white mb-1">
                {searchQuery ? 'No matching assets' : 'Your asset library is empty'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 mb-6">
                Upload images, videos, audio tracks, or reference documents to reuse across your VYROXX animation projects.
              </p>
              <button
                type="button"
                onClick={onOpenUploadModal}
                className="px-5 py-2.5 rounded-xl vyroxx-btn-primary text-xs sm:text-sm cursor-pointer"
              >
                Upload First Asset
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredAssets.map((asset) => {
                const isSelected = selectedCardId === asset.id;
                const isMenuOpen = activeMenuId === asset.id;

                return (
                  <div
                    key={asset.id}
                    onMouseEnter={() => setSelectedCardId(asset.id)}
                    onClick={() => onPreviewAsset(asset)}
                    className={`relative rounded-2xl p-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'vyroxx-glass vyroxx-card-active'
                        : 'vyroxx-glass hover:border-cyan-400/40'
                    }`}
                  >
                    <div className="relative rounded-xl overflow-hidden aspect-[16/10] bg-slate-950 mb-3">
                      <AuthenticatedAssetThumbnail asset={asset} />

                      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-white/15 backdrop-blur-md text-[11px] font-medium text-slate-200">
                        {asset.category}
                      </div>

                      {asset.favorited && (
                        <div className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-slate-950/75 border border-amber-400/40 flex items-center justify-center text-amber-400">
                          <Star className="w-3 h-3 fill-amber-400" />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 px-1">
                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-medium text-slate-100 truncate">
                          {asset.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                          <span>{asset.fileFormat}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{asset.fileSizeLabel}</span>
                        </div>
                      </div>

                      <div
                        className="relative shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveMenuId(isMenuOpen ? null : asset.id)}
                          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                          title="Asset Options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {isMenuOpen && (
                          <div className="absolute right-0 bottom-full mb-2 w-44 rounded-xl vyroxx-glass p-1.5 z-30 shadow-2xl border border-cyan-300/35">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onPreviewAsset(asset);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Preview</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onRenameAsset(asset);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-300" />
                              <span>Rename</span>
                            </button>
                            {(asset.mimeType.startsWith('image/') || asset.category === 'Characters' || asset.category === 'Images') && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuId(null);
                                  setRigAsset(asset);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-cyan-100 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                              >
                                <ScanLine className="w-3.5 h-3.5 text-cyan-300" />
                                <span>Rig Character</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onReuseInProject(asset);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-cyan-300" />
                              <span>Reuse in Project</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onDownloadAsset(asset);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-300" />
                              <span>Download</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onToggleFavoriteAsset(asset.id, !asset.favorited);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-200 hover:bg-cyan-500/20 hover:text-white cursor-pointer"
                            >
                              <Star className="w-3.5 h-3.5 text-amber-400" />
                              <span>{asset.favorited ? 'Unfavorite' : 'Favorite'}</span>
                            </button>
                            <div className="my-1 border-t border-white/10" />
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onDeleteAsset(asset);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/20 hover:text-rose-200 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {rigAsset && <CharacterRigStudio asset={rigAsset} onClose={() => setRigAsset(null)} />}
    </div>
  );
};
