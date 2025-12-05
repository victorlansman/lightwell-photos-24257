import { Photo, FaceDetection } from "@/types/photo";
import { PersonCluster } from "@/types/person";
import { X, ChevronLeft, ChevronRight, ChevronDown, Heart, Share2, Download, Info, Users, UserPlus, Check, Loader2, Menu, Calendar, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogContentFullscreen } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { SharePhotosDialog } from "@/components/SharePhotosDialog";
import { FaceBoundingBox } from "@/components/FaceBoundingBox";
import { EditPersonDialog } from "@/components/EditPersonDialog";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { azureApi } from "@/lib/azureApiClient";
import { usePhotoUrl } from "@/hooks/usePhotoUrl";
import { usePhotoDetail, usePrefetchPhotoDetail } from "@/hooks/usePhotoDetail";
import { useQueryClient } from "@tanstack/react-query";
import { ServerId, FaceTag } from "@/types/identifiers";

interface LightboxProps {
  photo: Photo | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleFavorite?: (photoId: string) => void;
  onUpdateFaces?: (photoId: string) => Promise<void>; // Called when faces are updated to refetch
  onPersonCreated?: (personId: ServerId, name: string) => void;
  allPeople?: PersonCluster[];
  collectionId: ServerId;
}

export function Lightbox({ photo, isOpen, onClose, onPrevious, onNext, onToggleFavorite, onUpdateFaces, onPersonCreated, allPeople = [], collectionId }: LightboxProps) {
  console.log('[Lightbox] Received collectionId:', collectionId);

  const [showInfo, setShowInfo] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFaces, setShowFaces] = useState(false);
  const [editingFace, setEditingFace] = useState<FaceDetection | null>(null);
  const [faces, setFaces] = useState<FaceDetection[]>([]);
  const [showNamingDialog, setShowNamingDialog] = useState(false);
  const [personToName, setPersonToName] = useState<FaceDetection | null>(null);
  const [newPersonName, setNewPersonName] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [faceToDelete, setFaceToDelete] = useState<FaceDetection | null>(null);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [newBox, setNewBox] = useState<FaceDetection | null>(null);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showDateInput, setShowDateInput] = useState(false);
  const [dateInputMode, setDateInputMode] = useState<'exact' | 'approximate'>('exact');
  const [showAiSection, setShowAiSection] = useState(true);
  // Date input fields - separate month/day for both exact and approximate modes
  const [userYear, setUserYear] = useState('');
  const [userMonth, setUserMonth] = useState(''); // 1-12
  const [userDay, setUserDay] = useState(''); // 1-31
  const [userYearMin, setUserYearMin] = useState('');
  const [userYearMax, setUserYearMax] = useState('');
  const [userMonthApprox, setUserMonthApprox] = useState(''); // For approximate mode
  const [userDayApprox, setUserDayApprox] = useState('');
  const [userDateComment, setUserDateComment] = useState('');
  const [isSavingDate, setIsSavingDate] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const prevPhotoId = useRef<string | null>(null);

  // Check if mobile device
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

  // Turn off showFaces when navigating to different photo on mobile
  useEffect(() => {
    if (photo?.id && prevPhotoId.current && photo.id !== prevPhotoId.current && isMobile) {
      setShowFaces(false);
    }
    prevPhotoId.current = photo?.id || null;
  }, [photo?.id, isMobile]);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  // Auto-hide controls after 4 seconds (mobile only, when menu is NOT open)
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Don't auto-hide on desktop or when menu/info panel is open
    if (!isMobile || showMenu || showInfo) return;

    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  }, [isMobile, showMenu, showInfo]);

  // Clear timeout when menu or info opens, restart when they close
  useEffect(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    // Only auto-hide when controls shown but menu/info closed
    if (showControls && isOpen && !showMenu && !showInfo) {
      resetControlsTimeout();
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [showControls, isOpen, showMenu, showInfo, resetControlsTimeout]);

  const { url: photoUrl, loading: photoLoading } = usePhotoUrl(photo?.id || '', {
    size: 'web_2048',
  });

  // Fetch full photo detail (reasoning, confidence, face bboxes)
  const { detail, isLoading: detailLoading, refetch: refetchDetail } = usePhotoDetail(photo?.id, {
    enabled: isOpen,
  });

  const queryClient = useQueryClient();

  // Initialize date input fields from detail when opened/loaded
  useEffect(() => {
    if (detail && showDateInput) {
      // Populate from existing user-corrected values
      setUserYear(detail.user_corrected_year?.toString() ?? '');
      // Parse user_corrected_date into month/day (format: "YYYY-MM" or "YYYY-MM-DD")
      if (detail.user_corrected_date) {
        const parts = detail.user_corrected_date.split('-');
        if (parts.length >= 2) {
          setUserMonth(parts[1]); // Month (01-12)
          if (parts.length === 3) {
            setUserDay(parts[2]); // Day (01-31)
          }
        }
      }
    }
  }, [detail, showDateInput]);

  // Auto-collapse AI section when user has set a date
  useEffect(() => {
    if (detail?.user_corrected_year) {
      setShowAiSection(false);
    } else {
      setShowAiSection(true);
    }
  }, [detail?.user_corrected_year]);

  // Debug: Log when photo changes
  useEffect(() => {
    if (photo?.id) {
      console.log('[Lightbox] Photo changed:', { photoId: photo.id, photoLoading, detailLoading });
    }
  }, [photo?.id, photoLoading, detailLoading]);

  // Load faces from detail response (has bboxes), fallback to photo.faces
  useEffect(() => {
    if (detail?.people) {
      // Detail has face bboxes - convert to FaceDetection format
      const detailFaces: FaceDetection[] = detail.people
        .filter(p => p.face_bbox !== null)
        .map(p => ({
          personId: p.id,
          personName: p.name,
          boundingBox: p.face_bbox!,
          clusterId: p.cluster_id,
        }));
      console.log('[Lightbox] Loaded faces from detail:', detailFaces.length);
      setFaces(detailFaces);
    } else if (photo?.faces) {
      console.log('[Lightbox] Using faces from photo prop:', photo.faces.length);
      setFaces(photo.faces);
    } else {
      setFaces([]);
    }
  }, [detail, photo]);

  // Track image dimensions for bounding box positioning
  useEffect(() => {
    const updateDimensions = () => {
      if (imgRef.current) {
        // Use getBoundingClientRect to get RENDERED dimensions (after CSS layout)
        // NOT img.width/height which return natural/intrinsic dimensions
        const rect = imgRef.current.getBoundingClientRect();
        const newWidth = rect.width;
        const newHeight = rect.height;

        // Only update if dimensions are valid and changed
        if (newWidth > 0 && newHeight > 0) {
          setImageDimensions(prev => {
            // Avoid unnecessary updates if dimensions haven't changed
            if (prev.width !== newWidth || prev.height !== newHeight) {
              console.log('[Lightbox] Image dimensions updated:', { width: newWidth, height: newHeight });
              return { width: newWidth, height: newHeight };
            }
            return prev;
          });
        }
      }
    };

    const img = imgRef.current;
    if (!img) return;

    // Use ResizeObserver to track dimension changes continuously
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    resizeObserver.observe(img);

    // Update on load
    img.addEventListener('load', updateDimensions);

    // Update immediately if already loaded
    if (img.complete) {
      updateDimensions();
    }

    // Also update after a brief delay to catch any layout shifts
    const rafId = requestAnimationFrame(() => {
      setTimeout(updateDimensions, 10);
    });

    return () => {
      resizeObserver.disconnect();
      img.removeEventListener('load', updateDimensions);
      cancelAnimationFrame(rafId);
    };
  }, [showInfo, photo, showFaces]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Auto-discard newBox if navigating away
      if (newBox) {
        setNewBox(null);
      }

      if (e.key === "ArrowLeft") {
        onPrevious();
      } else if (e.key === "ArrowRight") {
        onNext();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onPrevious, onNext, onClose, newBox]);

  // Touch/swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchStartY.current) return;
    if (!touchEndX.current || !touchEndY.current) return;

    const diffX = touchStartX.current - touchEndX.current;
    const diffY = touchStartY.current - touchEndY.current;
    const minSwipeDistance = 50;

    // Check if vertical swipe is dominant (swipe down to close)
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > minSwipeDistance) {
      if (diffY < 0) {
        // Swipe down - close lightbox
        onClose();
      }
    } else if (Math.abs(diffX) > minSwipeDistance) {
      // Horizontal swipe - navigate
      if (diffX > 0) {
        onNext();
      } else {
        onPrevious();
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
    touchStartY.current = null;
    touchEndY.current = null;
  };

  // Tap to toggle controls (mobile only)
  const handleTap = () => {
    // Don't toggle if we just swiped
    if (touchEndX.current !== null || touchEndY.current !== null) return;

    // If menu is open, just close it
    if (showMenu) {
      setShowMenu(false);
      return;
    }

    // If info panel is open, close it
    if (showInfo) {
      setShowInfo(false);
      return;
    }

    // Toggle controls (mobile only - desktop keeps controls visible)
    if (isMobile) {
      setShowControls(prev => !prev);
    }
  };

  if (!photo) return null;

  const handleToggleFavorite = () => {
    if (onToggleFavorite) {
      onToggleFavorite(photo.id);
      toast.success(photo.is_favorite ? "Removed from favorites" : "Added to favorites");
    }
  };

  const handleShare = () => {
    setShowShareDialog(true);
  };

  const handleDownload = async () => {
    if (!photo?.id) {
      toast.error("Photo not available");
      return;
    }

    try {
      // Fetch photo via authenticated endpoint
      const blob = await azureApi.fetchPhoto(photo.id, { thumbnail: false });

      // Create temporary URL for download
      const url = window.URL.createObjectURL(blob);

      // Trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = photo.original_filename || photo.filename || 'photo.jpg';
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success("Download started");
    } catch (error) {
      console.error('Download failed:', error);
      toast.error("Failed to download photo");
    }
  };

  // Helper to validate year is exactly 4 digits and between 1800-2100
  const isValidYear = (year: string) => {
    if (year.length !== 4) return false;
    const num = parseInt(year, 10);
    return !isNaN(num) && num >= 1800 && num <= 2100;
  };

  // Build date string from year/month/day
  const buildDateString = (year: string, month: string, day: string): string | null => {
    if (!year) return null;
    let dateStr = year;
    if (month) {
      dateStr += `-${month.padStart(2, '0')}`;
      if (day) {
        dateStr += `-${day.padStart(2, '0')}`;
      }
    }
    return dateStr;
  };

  const handleSaveDate = async () => {
    if (!photo?.id) return;

    // Validate years
    if (dateInputMode === 'exact') {
      if (!isValidYear(userYear)) {
        toast.error('Year must be between 1800 and 2100');
        return;
      }
    } else {
      if (userYearMin && !isValidYear(userYearMin)) {
        toast.error('From year must be between 1800 and 2100');
        return;
      }
      if (userYearMax && !isValidYear(userYearMax)) {
        toast.error('To year must be between 1800 and 2100');
        return;
      }
    }

    try {
      setIsSavingDate(true);

      // Build update payload based on mode - clear other mode's data to avoid conflicts
      const update: Parameters<typeof azureApi.updateYearEstimation>[1] = {};

      if (dateInputMode === 'exact') {
        // Exact mode: year required, month/day optional
        update.user_corrected_year = parseInt(userYear, 10);
        // Clear approximate range fields
        update.user_corrected_year_min = null;
        update.user_corrected_year_max = null;
        // Build date string if month provided
        const dateStr = buildDateString(userYear, userMonth, userDay);
        if (dateStr && userMonth) {
          update.user_corrected_date = dateStr;
        } else {
          update.user_corrected_date = null;
        }
      } else {
        // Approximate mode: year range with optional month/day
        update.user_corrected_year_min = userYearMin ? parseInt(userYearMin, 10) : null;
        update.user_corrected_year_max = userYearMax ? parseInt(userYearMax, 10) : null;
        // Calculate middle year for display_year if both provided
        if (userYearMin && userYearMax) {
          update.user_corrected_year = Math.round((parseInt(userYearMin, 10) + parseInt(userYearMax, 10)) / 2);
        }
        // Build date from middle year + optional month/day for approximate mode
        if (update.user_corrected_year && userMonthApprox) {
          update.user_corrected_date = buildDateString(
            String(update.user_corrected_year),
            userMonthApprox,
            userDayApprox
          );
        } else {
          update.user_corrected_date = null;
        }
      }

      // Comment (reasoning)
      if (userDateComment) {
        update.user_year_reasoning = userDateComment;
      }

      await azureApi.updateYearEstimation(photo.id, update);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['photo-detail', photo.id] });
      queryClient.invalidateQueries({ queryKey: ['photos'] });

      toast.success('Date saved');
      setShowDateInput(false);
    } catch (error) {
      console.error('Failed to save date:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save date');
    } finally {
      setIsSavingDate(false);
    }
  };

  const handleEditFace = (face: FaceDetection) => {
    setEditingFace(face);
  };

  const showWarningsIfPresent = (warnings: Array<{ field: string; message: string; value: string }> | undefined) => {
    if (warnings && warnings.length > 0) {
      warnings.forEach(warning => {
        console.warn('[Face Update Warning]', warning);
        toast(`Skipped: ${warning.message}`, {
          description: `Some faces couldn't be updated (orphaned person references)`,
        });
      });
    }
  };

  const handleUpdateBoundingBox = async (face: FaceDetection, newBox: { x: number; y: number; width: number; height: number }) => {
    if (!photo) return;

    try {
      // Update local state
      const updatedFaces = faces.map(f =>
        f === face ? { ...f, boundingBox: newBox } : f
      );
      setFaces(updatedFaces);

      // Persist to backend
      const faceTags = buildValidFaceTags(updatedFaces);

      const response = await azureApi.updatePhotoFaces(photo.id, faceTags);
      showWarningsIfPresent(response.warnings);

      // Refresh from server to confirm
      if (onUpdateFaces) {
        await onUpdateFaces(photo.id);
      }

      toast.success("Bounding box updated");
    } catch (error) {
      console.error('Failed to update bounding box:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update bounding box');
      // Revert on error
      setFaces(faces);
    }
  };

  const handleRemoveFace = async (face: FaceDetection) => {
    // Always show confirmation dialog for delete
    setFaceToDelete(face);
    setShowDeleteDialog(true);
  };

  const handleDisassociateFace = async () => {
    if (editingFace && photo) {
      setFaces(prevFaces => {
        const updatedFaces = prevFaces.map(f => 
          f === editingFace ? { ...f, personName: null, personId: null } : f
        );
        if (onUpdateFaces) {
          onUpdateFaces(photo.id, updatedFaces);
        }
        return updatedFaces;
      });
      toast.success("Face disassociated");
      setEditingFace(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (faceToDelete && photo) {
      try {
        // Remove face from local state
        const updatedFaces = faces.filter(f => f !== faceToDelete);
        setFaces(updatedFaces);

        // Persist to backend
        const faceTags = buildValidFaceTags(updatedFaces);

        const response = await azureApi.updatePhotoFaces(photo.id, faceTags);
        showWarningsIfPresent(response.warnings);

        // Refresh from server and update lightbox
        if (onUpdateFaces) {
          await onUpdateFaces(photo.id);
          // After refetch completes, the parent will pass new photo data
          // But we also update local faces to reflect deletion immediately
        }

        toast.success("Face tag deleted");
      } catch (error) {
        console.error('Failed to delete face:', error);
        toast.error('Failed to delete face tag');
        // Revert on error
        setFaces(faces);
      } finally {
        setFaceToDelete(null);
        setShowDeleteDialog(false);
      }
    }
  };

  const handleSelectPerson = async (personId: string, personName: string | null) => {
    if (!editingFace || !photo) return;

    const targetPerson = allPeople.find(p => p.id === personId);

    // If target person is unnamed, trigger naming dialog
    if (targetPerson && targetPerson.name === null) {
      setPersonToName({ ...editingFace, personId, personName });
      setShowNamingDialog(true);
      setEditingFace(null);
      return;
    }

    try {
      setIsSaving(true);

      // Update local state first
      const updatedFaces = faces.map(f =>
        f === editingFace
          ? { ...f, personId, personName }
          : f
      );
      setFaces(updatedFaces);

      // Send ALL faces to backend (preserve existing faces)
      const faceTags = buildValidFaceTags(updatedFaces);

      const response = await azureApi.updatePhotoFaces(photo.id, faceTags);
      showWarningsIfPresent(response.warnings);

      // Refresh photo
      if (onUpdateFaces) {
        await onUpdateFaces(photo.id);
      }

      toast.success(`Reassigned to ${personName || 'Unknown'}`);
      setEditingFace(null);
    } catch (error) {
      console.error('Failed to reassign person:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reassign');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewPerson = (prefilledName?: string) => {
    if (editingFace) {
      setPersonToName(editingFace);
      setNewPersonName(prefilledName || "");
      setShowNamingDialog(true);
      // Don't set editingFace to null yet - keep it for the naming flow
    }
  };

  const handleNamePerson = async () => {
    if (!personToName || !newPersonName.trim() || !photo) return;

    try {
      setIsSaving(true);

      // Step 1: Create person and get server ID
      const personId = await azureApi.createPersonAndReturnId(
        newPersonName.trim(),
        collectionId
      );

      // Step 2: Update local state with server ID
      const updatedFaces = faces.map(f =>
        f === personToName
          ? { ...f, personId, personName: newPersonName.trim() }
          : f
      );
      setFaces(updatedFaces);

      // Step 3: Send ALL faces to backend (preserve existing faces)
      const faceTags = buildValidFaceTags(updatedFaces);

      const response = await azureApi.updatePhotoFaces(photo.id, faceTags);
      showWarningsIfPresent(response.warnings);

      // Notify parent of new person (for people list refresh)
      onPersonCreated?.(personId, newPersonName.trim());

      // Refresh photo to get updated faces from server
      if (onUpdateFaces) {
        await onUpdateFaces(photo.id);
      }

      toast.success(`Created ${newPersonName.trim()}`);
      setShowNamingDialog(false);
      setNewPersonName("");
      setPersonToName(null);
    } catch (error) {
      console.error('Failed to create person:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create person');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNewPerson = () => {
    // Defensive: Don't create box if image dimensions are invalid
    if (imageDimensions.width === 0 || imageDimensions.height === 0) {
      console.warn('[handleAddNewPerson] Invalid image dimensions, retrying...', imageDimensions);
      toast.error('Please wait for image to load');

      // Retry after short delay
      setTimeout(() => {
        if (imageDimensions.width > 0 && imageDimensions.height > 0) {
          handleAddNewPerson();
        }
      }, 100);
      return;
    }

    // Create a new bounding box in the center of the image
    const newFace: FaceDetection = {
      boundingBox: {
        x: 40, // Center horizontally (with 20% width)
        y: 40, // Center vertically (with 20% height)
        width: 20,
        height: 20,
      },
      personId: null,
      personName: null,
    };

    console.log('[handleAddNewPerson] Creating new box with dimensions:', imageDimensions, 'box:', newFace.boundingBox);
    setNewBox(newFace);
  };

  const handleConfirmNewBox = async () => {
    if (!newBox || !photo) return;

    try {
      setIsSaving(true);

      // Build the complete face list INCLUDING the new box
      const allFaces = [...faces, newBox];

      console.log('[handleConfirmNewBox] Current faces + new:', {
        currentFacesCount: faces.length,
        newBoxAdded: true,
        totalToSave: allFaces.length,
        allFaces
      });

      // Update local state
      setFaces(allFaces);

      // Persist to backend
      const faceTags = buildValidFaceTags(allFaces);

      console.log('[handleConfirmNewBox] Sending to backend:', {
        photoId: photo.id,
        faceCount: faceTags.length,
        faceTags
      });

      const response = await azureApi.updatePhotoFaces(photo.id, faceTags);
      showWarningsIfPresent(response.warnings);

      // Refresh photo data
      if (onUpdateFaces) {
        await onUpdateFaces(photo.id);
      }

      // Now open dialog to assign person
      setEditingFace(newBox);
      setNewBox(null);

      toast.success("Face bounding box saved");
    } catch (error) {
      console.error('Failed to save face:', error);
      toast.error('Failed to save bounding box');
      // Revert: remove the newBox we just added
      setFaces(prevFaces => prevFaces.filter(f => f !== newBox));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscardNewBox = () => {
    // Simply discard the new box without saving
    setNewBox(null);
    toast.success("Changes discarded");
  };

  const handleCancelButton = () => {
    // Show confirmation dialog when clicking Cancel button
    setShowDiscardDialog(true);
  };

  const handleAddPersonFromDialog = () => {
    // Add person via reassign flow
    if (newBox && photo) {
      setFaces(prevFaces => [...prevFaces, newBox]);
      setEditingFace(newBox);
      setNewBox(null);
      setShowDiscardDialog(false);
    }
  };

  const handleDiscardFromDialog = () => {
    // Discard changes
    setNewBox(null);
    setShowDiscardDialog(false);
    toast.success("Changes discarded");
  };

  const handleUpdateNewBox = (newBoundingBox: { x: number; y: number; width: number; height: number }) => {
    if (newBox) {
      setNewBox({ ...newBox, boundingBox: newBoundingBox });
    }
  };

  const handleDialogClose = () => {
    // Auto-discard newBox if closing
    if (newBox) {
      setNewBox(null);
    }
    onClose();
  };

  // Helper: Deduplicates faces with identical bounding boxes, preferring named over unnamed
  // Backend handles invalid person_ids gracefully (returns 207 with warnings)
  const buildValidFaceTags = (facesToSave: FaceDetection[]): FaceTag[] => {
    // Deduplicate by bounding box - prefer named faces over unnamed
    const bboxMap = new Map<string, FaceDetection>();
    facesToSave.forEach(f => {
      const key = `${f.boundingBox.x},${f.boundingBox.y},${f.boundingBox.width},${f.boundingBox.height}`;
      const existing = bboxMap.get(key);

      // If no existing face with this bbox, add it
      if (!existing) {
        bboxMap.set(key, f);
      }
      // If existing face is unnamed but this one is named, replace it
      else if (!existing.personId && f.personId) {
        bboxMap.set(key, f);
      }
      // Otherwise keep the existing one (prefer first named face)
    });

    return Array.from(bboxMap.values()).map(f => ({
      person_id: f.personId,
      bbox: f.boundingBox,
    }));
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleDialogClose}>
        <DialogContentFullscreen ref={containerRef} className="[&>button]:hidden">
          {/* Header - only visible when showControls is true */}
          {showControls && (
            <div
              className={cn(
                "absolute top-0 left-0 z-50 flex items-center justify-between px-2 py-2 transition-all",
                showInfo ? "right-80" : "right-0"
              )}
              style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button - hidden when mobile menu is open */}
              {!showMenu && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-12 w-12 bg-background/80 hover:bg-background text-foreground rounded-full backdrop-blur-sm focus:outline-none focus-visible:ring-0"
                >
                  <X className="h-6 w-6" />
                </Button>
              )}
              {/* Spacer when menu is open to keep layout */}
              {showMenu && <div className="h-12 w-12 md:hidden" />}

              {/* Menu toggle - mobile only, becomes X when open */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMenu(!showMenu)}
                className="h-12 w-12 bg-background/80 hover:bg-background text-foreground rounded-full backdrop-blur-sm md:hidden focus:outline-none focus-visible:ring-0"
              >
                {showMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>

              {/* Desktop toolbar - hidden on mobile */}
              <div className="hidden md:flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => { handleToggleFavorite(); }} className="h-10 w-10 bg-background/80 hover:bg-background text-foreground rounded-full backdrop-blur-sm focus:outline-none focus-visible:ring-0">
                  <Heart className={cn("h-5 w-5", photo.is_favorite && "fill-red-500 text-red-500")} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { handleShare(); }} className="h-10 w-10 bg-background/80 hover:bg-background text-foreground rounded-full backdrop-blur-sm focus:outline-none focus-visible:ring-0">
                  <Share2 className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { handleDownload(); }} className="h-10 w-10 bg-background/80 hover:bg-background text-foreground rounded-full backdrop-blur-sm focus:outline-none focus-visible:ring-0">
                  <Download className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setShowFaces(!showFaces); }}
                  className={cn("h-10 w-10 bg-background/80 hover:bg-background text-foreground rounded-full backdrop-blur-sm focus:outline-none focus-visible:ring-0", showFaces && "bg-primary/20")}
                >
                  <Users className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setShowInfo(!showInfo); }}
                  className={cn("h-10 w-10 bg-background/80 hover:bg-background text-foreground rounded-full backdrop-blur-sm focus:outline-none focus-visible:ring-0", showInfo && "bg-primary/20")}
                >
                  <Info className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          {/* Mobile toolbar popup - horizontal in landscape, vertical in portrait */}
          {showControls && showMenu && (
            <div
              className="absolute top-16 right-2 z-50 md:hidden flex flex-col gap-1.5 p-2 bg-background/90 rounded-2xl backdrop-blur-sm max-h-[calc(100vh-5rem)] overflow-y-auto"
              style={{ marginTop: 'env(safe-area-inset-top)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { handleToggleFavorite(); setShowMenu(false); }}
                className="h-11 w-11 bg-background/80 hover:bg-background text-foreground rounded-full"
              >
                <Heart className={cn("h-5 w-5", photo.is_favorite && "fill-red-500 text-red-500")} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { handleShare(); setShowMenu(false); }}
                className="h-11 w-11 bg-background/80 hover:bg-background text-foreground rounded-full"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { handleDownload(); setShowMenu(false); }}
                className="h-11 w-11 bg-background/80 hover:bg-background text-foreground rounded-full"
              >
                <Download className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowFaces(!showFaces); setShowMenu(false); }}
                className={cn("h-11 w-11 bg-background/80 hover:bg-background text-foreground rounded-full", showFaces && "bg-primary/20")}
              >
                <Users className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setShowInfo(!showInfo); setShowMenu(false); }}
                className={cn("h-11 w-11 bg-background/80 hover:bg-background text-foreground rounded-full", showInfo && "bg-primary/20")}
              >
                <Info className="h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Main content area - full bleed */}
          <div
            className="absolute inset-0 flex flex-col overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleTap}
          >
            {/* Image - fills available space */}
            <div
              ref={imageRef}
              className={cn(
                "flex-1 flex items-center justify-center p-2 min-h-0 transition-all relative z-0",
                showInfo && "lg:pr-80"
              )}
            >
              <div className="relative w-full h-full flex items-center justify-center">
                {photoLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                )}
                {/* Image wrapper - positions bounding boxes correctly */}
                <div className="relative">
                  <img
                    ref={imgRef}
                    src={photoUrl || ''}
                    alt="Photo"
                    className={cn(
                      "max-w-full max-h-full object-contain animate-fade-in",
                      photoLoading && "opacity-0"
                    )}
                    style={{
                      maxHeight: 'calc(100vh - 1rem)',
                      maxWidth: showInfo ? 'calc(100vw - 21rem)' : 'calc(100vw - 1rem)'
                    }}
                  />
                  {showFaces && imageDimensions.width > 0 && (
                    <div
                      className="absolute top-0 left-0 z-10 pointer-events-none"
                      style={{
                        width: imageDimensions.width,
                        height: imageDimensions.height,
                      }}
                    >
                     {faces.map((face, idx) => (
                      <FaceBoundingBox
                        key={idx}
                        face={face}
                        imageWidth={imageDimensions.width}
                        imageHeight={imageDimensions.height}
                        onEdit={handleEditFace}
                        onRemove={handleRemoveFace}
                        onUpdateBoundingBox={handleUpdateBoundingBox}
                        allPeople={allPeople}
                        onCloseLightbox={onClose}
                      />
                    ))}
                    {newBox && (
                      <NewBoundingBox
                        face={newBox}
                        imageWidth={imageDimensions.width}
                        imageHeight={imageDimensions.height}
                        onConfirm={handleConfirmNewBox}
                        onDiscard={handleDiscardNewBox}
                        onUpdateBoundingBox={handleUpdateNewBox}
                      />
                    )}
                  </div>
                )}
                </div>
              </div>
            </div>

            {/* Info Panel */}
            {showInfo && (
              <div
                className={cn(
                  "absolute bg-card/95 backdrop-blur-sm p-4 space-y-4 overflow-y-auto z-50",
                  // Desktop: right side panel (absolute)
                  "lg:top-0 lg:right-0 lg:bottom-0 lg:w-80 lg:border-l lg:border-border",
                  // Mobile portrait: bottom sheet
                  "max-lg:portrait:bottom-0 max-lg:portrait:left-0 max-lg:portrait:right-0 max-lg:portrait:max-h-[60vh] max-lg:portrait:rounded-t-2xl max-lg:portrait:border-t max-lg:portrait:border-border",
                  // Mobile landscape: right side panel
                  "max-lg:landscape:top-0 max-lg:landscape:right-0 max-lg:landscape:bottom-0 max-lg:landscape:w-64 max-lg:landscape:border-l max-lg:landscape:border-border"
                )}
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))', paddingRight: 'max(1rem, env(safe-area-inset-right))' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Photo Info</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowInfo(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Filename</p>
                    <p className="text-sm text-foreground">{photo.filename || `photo-${photo.id}.jpg`}</p>
                  </div>

                  {/* === DATE SECTION === */}

                  {/* User-set date (if exists) - with edit pencil icon */}
                  {detail?.user_corrected_year && !showDateInput && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-muted-foreground">Photo Date</p>
                        <button
                          onClick={() => setShowDateInput(true)}
                          className="text-primary hover:text-primary/80 transition-colors"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-base text-foreground font-medium">
                        {(() => {
                          // Check if this is an approximate range (has min/max that differ)
                          const hasRange = detail.user_corrected_year_min && detail.user_corrected_year_max &&
                            detail.user_corrected_year_min !== detail.user_corrected_year_max;

                          let dateDisplay: string | number = detail.user_corrected_year;

                          // Format specific date if available
                          if (detail.user_corrected_date) {
                            const parts = detail.user_corrected_date.split('-');
                            if (parts.length >= 2) {
                              const year = parts[0];
                              const month = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1).toLocaleString('en-US', { month: 'long' });
                              if (parts.length === 3 && parts[2]) {
                                dateDisplay = `${month} ${parseInt(parts[2])}, ${year}`;
                              } else {
                                dateDisplay = `${month} ${year}`;
                              }
                            }
                          }

                          // Add range suffix for approximate dates
                          if (hasRange) {
                            return (
                              <>
                                {dateDisplay}
                                <span className="text-muted-foreground ml-1">
                                  ({detail.user_corrected_year_min}–{detail.user_corrected_year_max})
                                </span>
                              </>
                            );
                          }

                          return dateDisplay;
                        })()}
                      </p>
                      {/* User's comment about the date */}
                      {detail.user_year_reasoning && (
                        <p className="text-xs text-muted-foreground italic">
                          {detail.user_year_reasoning}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Set photo date button (when no date set) */}
                  {!detail?.user_corrected_year && !showDateInput && (
                    <button
                      onClick={() => setShowDateInput(true)}
                      className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <Calendar className="h-4 w-4" />
                      Set photo date
                    </button>
                  )}

                  {/* Date input form */}
                  {showDateInput && (
                    <div className="space-y-3 p-3 bg-secondary/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">Set Photo Date</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowDateInput(false)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* Mode toggle */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setDateInputMode('exact')}
                          className={cn(
                            "text-xs px-2 py-1 rounded transition-colors",
                            dateInputMode === 'exact'
                              ? "bg-primary text-primary-foreground"
                              : "bg-transparent text-primary border border-primary hover:bg-primary/10"
                          )}
                        >
                          Exact date
                        </button>
                        <button
                          onClick={() => setDateInputMode('approximate')}
                          className={cn(
                            "text-xs px-2 py-1 rounded transition-colors",
                            dateInputMode === 'approximate'
                              ? "bg-primary text-primary-foreground"
                              : "bg-transparent text-primary border border-primary hover:bg-primary/10"
                          )}
                        >
                          Approximate
                        </button>
                      </div>

                      {dateInputMode === 'exact' ? (
                        <div className="space-y-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            placeholder="Year (e.g., 1986)"
                            value={userYear}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setUserYear(val);
                            }}
                            className="h-8 text-sm"
                          />
                          <div className="flex gap-2">
                            <select
                              value={userMonth}
                              onChange={(e) => setUserMonth(e.target.value)}
                              className="h-8 text-sm flex-1 rounded-md border border-input bg-background px-2"
                            >
                              <option value="">Month (optional)</option>
                              {['January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                              ))}
                            </select>
                            <select
                              value={userDay}
                              onChange={(e) => setUserDay(e.target.value)}
                              className="h-8 text-sm w-20 rounded-md border border-input bg-background px-2"
                              disabled={!userMonth}
                            >
                              <option value="">Day</option>
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              placeholder="From year"
                              value={userYearMin}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setUserYearMin(val);
                              }}
                              className="h-8 text-sm flex-1"
                            />
                            <Input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={4}
                              placeholder="To year"
                              value={userYearMax}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setUserYearMax(val);
                              }}
                              className="h-8 text-sm flex-1"
                            />
                          </div>
                          <div className="flex gap-2">
                            <select
                              value={userMonthApprox}
                              onChange={(e) => setUserMonthApprox(e.target.value)}
                              className="h-8 text-sm flex-1 rounded-md border border-input bg-background px-2"
                            >
                              <option value="">Month (optional)</option>
                              {['January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => (
                                <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                              ))}
                            </select>
                            <select
                              value={userDayApprox}
                              onChange={(e) => setUserDayApprox(e.target.value)}
                              className="h-8 text-sm w-20 rounded-md border border-input bg-background px-2"
                              disabled={!userMonthApprox}
                            >
                              <option value="">Day</option>
                              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      <Input
                        type="text"
                        placeholder="Comment (e.g., Father's birthday)"
                        value={userDateComment}
                        onChange={(e) => setUserDateComment(e.target.value)}
                        className="h-8 text-sm"
                      />

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleSaveDate}
                          disabled={isSavingDate || (dateInputMode === 'exact' ? !isValidYear(userYear) : !isValidYear(userYearMin) || !isValidYear(userYearMax))}
                          className="flex-1"
                        >
                          {isSavingDate ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowDateInput(false);
                            setUserYear('');
                            setUserMonth('');
                            setUserDay('');
                            setUserYearMin('');
                            setUserYearMax('');
                            setUserMonthApprox('');
                            setUserDayApprox('');
                            setUserDateComment('');
                          }}
                          disabled={isSavingDate}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* AI Estimated Year Section */}
                  <div className={cn(
                    "space-y-2 p-3 bg-muted/30 rounded-lg border border-border/50",
                    detail?.user_corrected_year && "mt-2"
                  )}>
                    {/* Collapsible header when user has set a date */}
                    {detail?.user_corrected_year ? (
                      <button
                        onClick={() => setShowAiSection(!showAiSection)}
                        className="flex items-center justify-between w-full text-left"
                      >
                        <p className="text-sm font-medium text-muted-foreground">AI Estimated Year</p>
                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          !showAiSection && "-rotate-90"
                        )} />
                      </button>
                    ) : (
                      <p className="text-sm font-medium text-muted-foreground">AI Estimated Year</p>
                    )}

                    {/* AI content - collapsible if user has set date */}
                    {(showAiSection || !detail?.user_corrected_year) && (
                      <div className="space-y-2">
                        <p className="text-sm text-foreground">
                          {photo.display_year ? (
                            <>
                              {photo.display_year}
                              {photo.estimated_year_min && photo.estimated_year_max &&
                               photo.estimated_year_min !== photo.estimated_year_max && (
                                <span className="text-muted-foreground ml-1">
                                  ({photo.estimated_year_min}–{photo.estimated_year_max})
                                </span>
                              )}
                            </>
                          ) : (
                            'Unknown'
                          )}
                          {detail?.estimated_year_confidence != null && (
                            <span className="text-xs text-muted-foreground ml-2">
                              {Math.round(detail.estimated_year_confidence * 100)}% confidence
                            </span>
                          )}
                        </p>

                        {detail?.year_estimation_reasoning && (
                          <p className="text-xs text-muted-foreground italic leading-relaxed">
                            {detail.year_estimation_reasoning}
                          </p>
                        )}

                        {detailLoading && (
                          <p className="text-xs text-muted-foreground">Loading AI analysis...</p>
                        )}
                      </div>
                    )}
                  </div>

                  {faces.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">People in Photo</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {faces.map((face, idx) => {
                          const displayName = face.personName || (face.clusterId ? "Unknown" : "Unnamed person");
                          const navigableId = face.personId || face.clusterId;
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (navigableId) {
                                  onClose();
                                  navigate(`/people/${navigableId}`);
                                }
                              }}
                              className={cn(
                                "text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded transition-colors",
                                navigableId && "hover:bg-primary hover:text-primary-foreground cursor-pointer"
                              )}
                            >
                              {displayName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {photo.user_notes && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Notes</p>
                      <p className="text-sm text-foreground">{photo.user_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons - hidden on mobile (use swipe), visible on desktop */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/80 hover:bg-background text-foreground z-50 hidden md:flex backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); onPrevious(); }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-background/80 hover:bg-background text-foreground z-50 hidden md:flex backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Add new person / Cancel button */}
          {showFaces && showControls && (
            <div
              className="absolute bottom-0 left-0 right-0 flex justify-center z-50 pointer-events-none"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
            >
              {!newBox ? (
                <Button
                  className="pointer-events-auto shadow-lg"
                  onClick={handleAddNewPerson}
                  disabled={imageDimensions.width === 0 || imageDimensions.height === 0}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add new person
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="pointer-events-auto shadow-lg"
                  onClick={handleCancelButton}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          )}
        </DialogContentFullscreen>
      </Dialog>

      <SharePhotosDialog
        photoIds={[photo.id]}
        isOpen={showShareDialog}
        onClose={() => setShowShareDialog(false)}
      />

        <EditPersonDialog
          face={editingFace}
          isOpen={!!editingFace}
          onClose={() => setEditingFace(null)}
          allPeople={allPeople}
          onSelectPerson={handleSelectPerson}
          onCreateNew={handleCreateNewPerson}
          onDisassociate={handleDisassociateFace}
        />

      <Dialog open={showNamingDialog} onOpenChange={() => {
        setShowNamingDialog(false);
        setNewPersonName("");
      }}>
        <DialogContent className="sm:max-w-md" aria-describedby="naming-dialog-description">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Name This Person</h3>
            <p id="naming-dialog-description" className="sr-only">Enter a name for this person</p>
            <Input
              type="text"
              placeholder="Enter name..."
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNamePerson();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowNamingDialog(false);
                setNewPersonName("");
              }} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleNamePerson} disabled={!newPersonName.trim() || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={() => setShowDeleteDialog(false)}>
        <DialogContent className="sm:max-w-md" aria-describedby="delete-dialog-description">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Delete the tag of this person?</h3>
            <p id="delete-dialog-description" className="text-sm text-muted-foreground">
              This will permanently remove the face tag from this photo.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => {
                setShowDeleteDialog(false);
                setFaceToDelete(null);
              }}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>
                Yes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you want to add this person?</AlertDialogTitle>
            <AlertDialogDescription>
              You have an unsaved bounding box. Choose to add this person or discard your changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDiscardFromDialog} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Discard changes
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAddPersonFromDialog}>
              Add person
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Component for creating new bounding boxes
interface NewBoundingBoxProps {
  face: FaceDetection;
  imageWidth: number;
  imageHeight: number;
  onConfirm: () => void;
  onDiscard: () => void;
  onUpdateBoundingBox: (newBox: { x: number; y: number; width: number; height: number }) => void;
}

function NewBoundingBox({ face, imageWidth, imageHeight, onConfirm, onDiscard, onUpdateBoundingBox }: NewBoundingBoxProps) {
  const [editBox, setEditBox] = useState(face.boundingBox);
  const boxRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, boxX: 0, boxY: 0 });
  const resizeHandleRef = useRef<string | null>(null);

  // Defensive check: Don't render if image dimensions are invalid
  if (imageWidth === 0 || imageHeight === 0) {
    console.warn('[NewBoundingBox] Invalid image dimensions:', { imageWidth, imageHeight });
    return null;
  }

  const left = (editBox.x / 100) * imageWidth;
  const top = (editBox.y / 100) * imageHeight;
  const width = (editBox.width / 100) * imageWidth;
  const height = (editBox.height / 100) * imageHeight;

  const handleMouseDown = (e: React.MouseEvent, handle?: string) => {
    e.stopPropagation();
    
    isDraggingRef.current = true;
    resizeHandleRef.current = handle || null;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      boxX: editBox.x,
      boxY: editBox.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = ((moveEvent.clientX - dragStartRef.current.x) / imageWidth) * 100;
      const deltaY = ((moveEvent.clientY - dragStartRef.current.y) / imageHeight) * 100;

      if (resizeHandleRef.current) {
        // Resizing
        const newBox = { ...editBox };
        
        if (resizeHandleRef.current.includes('top')) {
          newBox.y = Math.max(0, Math.min(100 - newBox.height, dragStartRef.current.boxY + deltaY));
          newBox.height = editBox.height - (newBox.y - editBox.y);
        }
        if (resizeHandleRef.current.includes('bottom')) {
          newBox.height = Math.max(5, Math.min(100 - newBox.y, editBox.height + deltaY));
        }
        if (resizeHandleRef.current.includes('left')) {
          newBox.x = Math.max(0, Math.min(100 - newBox.width, dragStartRef.current.boxX + deltaX));
          newBox.width = editBox.width - (newBox.x - editBox.x);
        }
        if (resizeHandleRef.current.includes('right')) {
          newBox.width = Math.max(5, Math.min(100 - newBox.x, editBox.width + deltaX));
        }
        
        setEditBox(newBox);
        onUpdateBoundingBox(newBox);
      } else {
        // Moving
        const newX = Math.max(0, Math.min(100 - editBox.width, dragStartRef.current.boxX + deltaX));
        const newY = Math.max(0, Math.min(100 - editBox.height, dragStartRef.current.boxY + deltaY));
        const newBox = { ...editBox, x: newX, y: newY };
        setEditBox(newBox);
        onUpdateBoundingBox(newBox);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      resizeHandleRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={boxRef}
      className="absolute border-2 border-emerald-500 cursor-move z-40 pointer-events-auto"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
      }}
      onMouseDown={(e) => handleMouseDown(e)}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Resize handles - green */}
      <div className="absolute -top-1 -left-1 w-3 h-3 bg-emerald-500 rounded-full cursor-nw-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'top-left')} />
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-500 rounded-full cursor-n-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'top')} />
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full cursor-ne-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'top-right')} />
      <div className="absolute top-1/2 -translate-y-1/2 -left-1 w-3 h-3 bg-emerald-500 rounded-full cursor-w-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'left')} />
      <div className="absolute top-1/2 -translate-y-1/2 -right-1 w-3 h-3 bg-emerald-500 rounded-full cursor-e-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'right')} />
      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-emerald-500 rounded-full cursor-sw-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'bottom-left')} />
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-500 rounded-full cursor-s-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'bottom')} />
      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full cursor-se-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'bottom-right')} />
      
      {/* Person name flag with confirm/discard buttons */}
      <div className="absolute -top-12 left-0 px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 shadow-lg bg-emerald-500 text-white z-50 pointer-events-auto">
        <span>New person</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 hover:bg-white/20 text-white"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            <Check className="h-3 w-3 mr-1" />
            Confirm
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 hover:bg-red-600 bg-red-500 text-white"
            onClick={(e) => {
              e.stopPropagation();
              onDiscard();
            }}
          >
            <X className="h-3 w-3 mr-1" />
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}