import { useState } from "react";
import { Header } from "@/components/Header";
import { AppSidebar } from "@/components/AppSidebar";
import { PeopleGallery } from "@/components/PeopleGallery";
import { SidebarProvider } from "@/components/ui/sidebar";
import { mockPeople } from "@/data/mockPeople";
import { PersonCluster } from "@/types/person";

export default function People() {
  const [people, setPeople] = useState<PersonCluster[]>(mockPeople);
  const [selectedClusters, setSelectedClusters] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const handleSelectCluster = (id: string) => {
    setSelectedClusters((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedClusters(new Set());
    }
  };

  const handleMerge = (clusterIds: string[]) => {
    // In a real app, this would merge the clusters via API
    // For now, we'll just remove the merged clusters except the first one
    const [firstId, ...restIds] = clusterIds;
    const firstCluster = people.find((p) => p.id === firstId);
    const mergeClusters = people.filter((p) => restIds.includes(p.id));

    if (!firstCluster) return;

    // Combine all photos
    const allPhotos = [
      ...firstCluster.photos,
      ...mergeClusters.flatMap((c) => c.photos),
    ];

    // Update the first cluster
    const updatedPeople = people
      .filter((p) => !restIds.includes(p.id))
      .map((p) =>
        p.id === firstId
          ? { ...p, photos: allPhotos, photoCount: allPhotos.length }
          : p
      );

    setPeople(updatedPeople);
    setSelectedClusters(new Set());
    setIsSelectionMode(false);
  };

  const handleHide = (clusterIds: string[]) => {
    // In a real app, this would hide via API
    // For now, we'll just remove them from the list
    setPeople((prev) => prev.filter((p) => !clusterIds.includes(p.id)));
    setSelectedClusters(new Set());
    setIsSelectionMode(false);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <Header />
          <main className="flex-1 p-6">
            <PeopleGallery
              people={people}
              selectedClusters={selectedClusters}
              isSelectionMode={isSelectionMode}
              onSelectCluster={handleSelectCluster}
              onToggleSelectionMode={handleToggleSelectionMode}
              onMerge={handleMerge}
              onHide={handleHide}
            />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
