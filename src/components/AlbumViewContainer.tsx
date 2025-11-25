import { ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import { useInView } from 'react-intersection-observer';
import { Photo } from '@/types/photo';
import { PersonCluster } from '@/types/person';
import { AlbumViewControls } from '@/components/AlbumViewControls';
import { PhotoCard } from '@/components/PhotoCard';
import { FacePhotoCard } from '@/components/FacePhotoCard';
import { Lightbox } from '@/components/Lightbox';
import { SharePhotosDialog } from '@/components/SharePhotosDialog';
import { Button } from '@/components/ui/button';
import { useAlbumLightbox } from '@/hooks/useAlbumPhotos';
import { format, isSameDay, parseISO } from 'date-fns';
import { ThumbnailAbortContext } from '@/hooks/useThumbnailAbort';

export interface AlbumViewContainerProps {
  photos: Photo[];
  allPeople: PersonCluster[];
  collectionId: string | string[];
  isLoading?: boolean;

  // View customization
  showFilters?: boolean;
  showViewControls?: boolean;
  defaultZoomLevel?: number;
  gridMode?: 'standard' | 'faces';
  personId?: string; // For face mode

  // Selection & Actions
  enableSelection?: boolean;
  availableActions?: ('download' | 'share' | 'delete' | 'remove')[];
  onBulkAction?: (action: string, photoIds: string[]) => void;

  // Custom renders
  renderHeader?: () => ReactNode;
  renderFilters?: () => ReactNode;
  renderEmptyState?: () => ReactNode;

  // Callbacks
  onPhotoSelect?: (photoIds: string[]) => void;
  onNavigate?: (path: string) => void;
  onPhotoFacesUpdated?: (photoId: string) => Promise<void>; // Called when faces are modified in lightbox
  onFaceClick?: (face: any, photoId: string) => void; // For thumbnail selection mode

  // Pagination
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

export function AlbumViewContainer({
  photos,
  allPeople,
  collectionId,
  isLoading = false,
  showViewControls = true,
  defaultZoomLevel = 4,
  gridMode = 'standard',
  personId,
  enableSelection = true,
  availableActions = ['share'],
  showFilters = false,
  renderHeader,
  renderFilters,
  renderEmptyState,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  onFaceClick,
  ...props
}: AlbumViewContainerProps) {
  // View controls state
  const [zoomLevel, setZoomLevel] = useState(defaultZoomLevel);
  const [showDates, setShowDates] = useState(true);
  const [cropSquare, setCropSquare] = useState(true);
  // Default to full photos, not face thumbnails
  const [showFaces, setShowFaces] = useState(false);

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());

  // Dialog states
  const [showShareDialog, setShowShareDialog] = useState(false);

  // Lightbox management
  const lightbox = useAlbumLightbox(photos);

  // Thumbnail fetch abort controller - allows aborting thumbnails when lightbox opens
  const thumbnailAbortRef = useRef(new AbortController());

  // When lightbox opens, abort all thumbnail fetches to free up connection pool for full-size photo
  useEffect(() => {
    if (lightbox.isOpen) {
      // Abort all pending thumbnail fetches
      thumbnailAbortRef.current.abort();
      console.log('[AlbumViewContainer] Lightbox opened - aborting thumbnail fetches');
      // Create new controller for future thumbnail fetches
      thumbnailAbortRef.current = new AbortController();
    }
  }, [lightbox.isOpen]);

  // Infinite scroll trigger
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0,
    rootMargin: '200px', // Trigger 200px before reaching end
  });

  // Trigger load more when in view
  useEffect(() => {
    if (inView && hasMore && !isLoadingMore && onLoadMore) {
      onLoadMore();
    }
  }, [inView, hasMore, isLoadingMore, onLoadMore]);

  // Group photos by date
  const photosByDate = useMemo(() => {
    const groups: { date: string; photos: Photo[] }[] = [];

    photos.forEach(photo => {
      const photoDate = format(parseISO(photo.created_at), 'yyyy-MM-dd');
      const existingGroup = groups.find(g => g.date === photoDate);

      if (existingGroup) {
        existingGroup.photos.push(photo);
      } else {
        groups.push({ date: photoDate, photos: [photo] });
      }
    });

    return groups;
  }, [photos]);

  // Selection handlers
  const handleSelectPhoto = (photoId: string) => {
    setSelectedPhotos(prev => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedPhotos(new Set());
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedPhotos.size === photos.length) {
      setSelectedPhotos(new Set());
    } else {
      setSelectedPhotos(new Set(photos.map(p => p.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedPhotos(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkAction = (action: string) => {
    if (action === 'share') {
      setShowShareDialog(true);
    } else if (props.onBulkAction) {
      props.onBulkAction(action, Array.from(selectedPhotos));
    }
  };

  // Photo click handler
  const handlePhotoClick = (photo: Photo) => {
    if (!isSelectionMode) {
      lightbox.openLightbox(photo);
    }
  };

  // Normalize collection ID
  const normalizedCollectionId = Array.isArray(collectionId) ? collectionId[0] : collectionId;

  return (
    <ThumbnailAbortContext.Provider value={{ abortController: thumbnailAbortRef.current }}>
      <div className="flex-1 flex flex-col">
        {/* View controls */}
        {showViewControls && (
          <AlbumViewControls
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
            showDates={showDates}
            onToggleDates={() => setShowDates(!showDates)}
            cropSquare={cropSquare}
            onToggleCropSquare={() => setCropSquare(!cropSquare)}
            showFaces={showFaces}
            onToggleFaces={personId ? () => setShowFaces(!showFaces) : undefined}
          />
        )}

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="space-y-4 md:space-y-6 max-w-[1600px]">
            {/* Custom header */}
            {renderHeader?.()}

            {/* Filters */}
            {showFilters && renderFilters?.()}

            {/* Selection mode controls */}
            {enableSelection && (
              <div className="flex items-center gap-2">
                {isSelectionMode ? (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      onClick={handleToggleSelectAll}
                    >
                      {selectedPhotos.size === photos.length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearSelection}
                    >
                      Cancel
                    </Button>
                    {selectedPhotos.size > 0 && availableActions.includes('share') && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleBulkAction('share')}
                      >
                        Share ({selectedPhotos.size})
                      </Button>
                    )}
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleSelectionMode}
                  >
                    Select
                  </Button>
                )}
              </div>
            )}

            {/* Photo grid */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">Loading...</div>
              </div>
            ) : photos.length === 0 ? (
              renderEmptyState?.() || (
                <div className="flex items-center justify-center py-12">
                  <div className="text-muted-foreground">No photos found</div>
                </div>
              )
            ) : (
              <>
                {photosByDate.map((group) => (
                  <div key={group.date} className="space-y-2">
                    {/* Date header */}
                    {showDates && (
                      <h2 className="text-lg font-semibold text-foreground sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10">
                        {format(parseISO(group.date), 'EEEE, MMMM d, yyyy')}
                      </h2>
                    )}

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${zoomLevel}, minmax(0, 1fr))`,
                        gap: '0.5rem',
                      }}
                    >
                      {group.photos.map(photo => {
                        // For person albums: use showFaces state to control display mode
                        // For other contexts: use gridMode prop
                        // If onFaceClick is provided (thumbnail selection mode), force face view
                        const shouldShowFaces = onFaceClick ? true : (personId ? showFaces : (gridMode === 'faces'));

                        if (shouldShowFaces && personId) {
                          // Find the face for this person in this photo
                          const face = photo.faces?.find(f => f.personId === personId);

                          return (
                            <FacePhotoCard
                              key={photo.id}
                              photo={photo}
                              personId={personId}
                              isSelected={selectedPhotos.has(photo.id)}
                              onSelect={() => handleSelectPhoto(photo.id)}
                              onClick={() => {
                                // If onFaceClick is provided (thumbnail selection mode), use it
                                if (onFaceClick && face) {
                                  onFaceClick(face, photo.id);
                                } else {
                                  handlePhotoClick(photo);
                                }
                              }}
                              isSelectionMode={isSelectionMode}
                              isThumbnailSelection={!!onFaceClick}
                            />
                          );
                        }

                        return (
                          <PhotoCard
                            key={photo.id}
                            photo={photo}
                            isSelected={selectedPhotos.has(photo.id)}
                            onSelect={() => handleSelectPhoto(photo.id)}
                            onClick={() => handlePhotoClick(photo)}
                            isSelectionMode={isSelectionMode}
                            cropSquare={cropSquare}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Load more trigger for infinite scroll */}
                {hasMore && (
                  <div ref={loadMoreRef} className="flex justify-center py-4">
                    {isLoadingMore ? (
                      <div className="text-muted-foreground text-sm">Loading more...</div>
                    ) : (
                      <div className="h-4" />
                    )}
                  </div>
                )}

                {/* End of results */}
                {!hasMore && photos.length > 0 && (
                  <div className="text-center text-muted-foreground text-sm py-4">
                    All photos loaded ({photos.length} total)
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Lightbox */}
      <Lightbox
        photo={lightbox.lightboxPhoto}
        isOpen={lightbox.isOpen}
        onClose={lightbox.closeLightbox}
        onPrevious={lightbox.goToPrevious}
        onNext={lightbox.goToNext}
        onToggleFavorite={lightbox.handleToggleFavorite}
        onUpdateFaces={props.onPhotoFacesUpdated ? async (photoId: string) => {
          await props.onPhotoFacesUpdated!(photoId);
        } : undefined}
        allPeople={allPeople}
        collectionId={normalizedCollectionId}
      />

      {/* Share dialog */}
      <SharePhotosDialog
        photoIds={Array.from(selectedPhotos)}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        onShareComplete={() => {
          setSelectedPhotos(new Set());
          setIsSelectionMode(false);
        }}
      />
    </ThumbnailAbortContext.Provider>
    </>
  );
}
