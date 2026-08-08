'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Plus, X } from 'lucide-react';
import type { InventoryRow } from '@/server/inventory/queries';
import { uploadSlabPhotoAction, deleteSlabPhotoAction } from '@/server/inventory/actions';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

type Props = { slab: InventoryRow };

/** Staff-captured photos of the physical slab — opt-in, multi-photo (H1.1). */
export function SlabPhotoGallery({ slab }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, confirmDialog } = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const photos = slab.photos;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    startTransition(async () => {
      for (const file of picked) {
        const formData = new FormData();
        formData.set('file', file);
        const res = await uploadSlabPhotoAction(slab.id, formData);
        if (!res.ok) {
          toast(res.error, 'error');
          return;
        }
      }
      toast(picked.length === 1 ? 'Photo added.' : `${picked.length} photos added.`, 'success');
      router.refresh();
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (photoId: string) => {
    const ok = await confirm({
      title: 'Remove this photo?',
      message: 'The photo will be permanently deleted.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteSlabPhotoAction(photoId);
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      if (lightboxId === photoId) setLightboxId(null);
      toast('Photo removed.', 'success');
      router.refresh();
    });
  };

  return (
    <div className="px-6 py-4 border-b border-[var(--color-basalt-500)]" data-testid="slab-photo-gallery">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Camera size={14} className="text-[var(--color-sodalite)] shrink-0" aria-hidden />
          <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-fog-400)] font-medium">
            Photos{photos.length > 0 ? ` · ${photos.length}` : ''}
          </h3>
        </div>
        <Button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isPending}
          variant="ghost"
          className="!min-h-7 !px-2 text-[11px] gap-1"
        >
          <Plus size={13} /> Add photos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {photos.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="No photos yet"
          hint="Add a photo so anyone browsing this slab's passport sees the actual piece."
          action={
            <Button type="button" onClick={() => fileInputRef.current?.click()} variant="secondary">
              Add photos
            </Button>
          }
          className="py-8 bg-[var(--color-basalt-900)] border border-[var(--color-basalt-500)] border-dashed rounded-md"
        />
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group aspect-square">
              <button
                type="button"
                onClick={() => setLightboxId(photo.id)}
                className="w-full h-full rounded-[var(--radius-md)] overflow-hidden border border-[var(--color-basalt-500)] hover:border-[rgba(227,193,108,0.35)] transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/slab-photos/${photo.id}`}
                  alt={`${slab.uniqueSlabId} photo`}
                  className="w-full h-full object-cover"
                />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                aria-label="Remove photo"
                disabled={isPending}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-black/80 transition-opacity disabled:opacity-50"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!lightboxId}
        onClose={() => setLightboxId(null)}
        title={slab.uniqueSlabId}
        width={640}
        zIndex={90}
      >
        {lightboxId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/slab-photos/${lightboxId}`}
            alt={`${slab.uniqueSlabId} photo`}
            className="w-full h-auto rounded-[var(--radius-md)]"
          />
        )}
      </Modal>
      {confirmDialog}
    </div>
  );
}
