import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Heart, User, Tag, X } from "lucide-react";

interface Photo {
  taken_at: string | null;
  tags: string[];
  people?: Array<{ id: string; name: string }>;
}

interface PhotoFiltersProps {
  photos: Photo[];
  yearRange: [number, number];
  onYearRangeChange: (range: [number, number]) => void;
  selectedPeople: string[];
  onSelectedPeopleChange: (people: string[]) => void;
  selectedTags: string[];
  onSelectedTagsChange: (tags: string[]) => void;
  showFavoritesOnly: boolean;
  onShowFavoritesOnlyChange: (show: boolean) => void;
}

export function PhotoFilters({
  photos,
  yearRange,
  onYearRangeChange,
  selectedPeople,
  onSelectedPeopleChange,
  selectedTags,
  onSelectedTagsChange,
  showFavoritesOnly,
  onShowFavoritesOnlyChange,
}: PhotoFiltersProps) {
  const allPeople = useMemo(() => {
    const peopleMap = new Map<string, string>();
    photos.forEach(photo => {
      photo.people?.forEach(person => {
        peopleMap.set(person.id, person.name);
      });
    });
    return Array.from(peopleMap.entries()).map(([id, name]) => ({ id, name }));
  }, [photos]);

  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    photos.forEach(photo => {
      photo.tags.forEach(tag => tagsSet.add(tag));
    });
    return Array.from(tagsSet).sort();
  }, [photos]);

  const yearStats = useMemo(() => {
    const years = photos
      .filter(p => p.taken_at)
      .map(p => new Date(p.taken_at!).getFullYear());
    if (years.length === 0) return { min: 1900, max: new Date().getFullYear() };
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [photos]);

  const hasActiveFilters = selectedPeople.length > 0 || selectedTags.length > 0 || showFavoritesOnly ||
    yearRange[0] !== yearStats.min || yearRange[1] !== yearStats.max;

  const clearFilters = () => {
    onYearRangeChange([yearStats.min, yearStats.max]);
    onSelectedPeopleChange([]);
    onSelectedTagsChange([]);
    onShowFavoritesOnlyChange(false);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      {/* Year Range */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground flex items-center gap-2">
          Year Range: {yearRange[0]} - {yearRange[1]}
        </label>
        <Slider
          value={yearRange}
          onValueChange={(value) => onYearRangeChange(value as [number, number])}
          min={yearStats.min}
          max={yearStats.max}
          step={1}
          className="w-full"
        />
      </div>

      {/* People Filter */}
      {allPeople.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <User className="h-4 w-4" />
            People
          </label>
          <Select
            value=""
            onValueChange={(personId) => {
              if (!selectedPeople.includes(personId)) {
                onSelectedPeopleChange([...selectedPeople, personId]);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select people..." />
            </SelectTrigger>
            <SelectContent>
              {allPeople
                .filter(p => !selectedPeople.includes(p.id))
                .map(person => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {selectedPeople.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedPeople.map(personId => {
                const person = allPeople.find(p => p.id === personId);
                return person ? (
                  <Badge key={personId} variant="secondary" className="gap-1">
                    {person.name}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() =>
                        onSelectedPeopleChange(selectedPeople.filter(id => id !== personId))
                      }
                    />
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </div>
      )}

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Tags
          </label>
          <Select
            value=""
            onValueChange={(tag) => {
              if (!selectedTags.includes(tag)) {
                onSelectedTagsChange([...selectedTags, tag]);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select tags..." />
            </SelectTrigger>
            <SelectContent>
              {allTags
                .filter(tag => !selectedTags.includes(tag))
                .map(tag => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() =>
                      onSelectedTagsChange(selectedTags.filter(t => t !== tag))
                    }
                  />
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Favorites Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={showFavoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => onShowFavoritesOnlyChange(!showFavoritesOnly)}
        >
          <Heart className={`h-4 w-4 mr-2 ${showFavoritesOnly ? "fill-current" : ""}`} />
          Favorites Only
        </Button>
      </div>
    </div>
  );
}
