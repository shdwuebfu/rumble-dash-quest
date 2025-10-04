import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useOrganizationTheme } from "@/hooks/use-organization-theme";

interface TransferPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
  currentCategoryId: string;
  onTransfer: () => void;
}

export function TransferPlayerModal({
  isOpen,
  onClose,
  playerId,
  currentCategoryId,
  onTransfer,
}: TransferPlayerModalProps) {
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>("");
  const [selectedSeasonType, setSelectedSeasonType] = useState<'youth' | 'senior' | ''>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Fetch seasons
  useEffect(() => {
    const fetchSeasons = async () => {
      // Fetch both youth and senior seasons
      const [youthResponse, seniorResponse] = await Promise.all([
        supabase
          .from("seasons")
          .select("*")
          .order('created_at', { ascending: false }),
        supabase
          .from("senior_seasons")
          .select("*")
          .order('created_at', { ascending: false })
      ]);
      
      if (youthResponse.error || seniorResponse.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudieron cargar las temporadas",
        });
        return;
      }
      
      // Combine both types of seasons with a type indicator
      const allSeasons = [
        ...(youthResponse.data || []).map(s => ({ ...s, type: 'youth' })),
        ...(seniorResponse.data || []).map(s => ({ ...s, type: 'senior' }))
      ];
      
      setSeasons(allSeasons);
    };

    if (isOpen) {
      fetchSeasons();
    }
  }, [isOpen]);

  // Fetch categories when season changes
  useEffect(() => {
    const fetchCategories = async () => {
      if (!selectedSeasonId || !selectedSeasonType) {
        setCategories([]);
        return;
      }
      
      // Determine which table to query based on the selected season type
      const tableName = selectedSeasonType === 'youth' ? "categories" : "senior_categories";
      const seasonField = selectedSeasonType === 'youth' ? "season_id" : "senior_season_id";
      
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*")
        .eq(seasonField, selectedSeasonId)
        .order("name");
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudieron cargar las categorías",
        });
        return;
      }
      
      // Only filter out current category if we're in the same type of football
      const currentIsYouth = window.location.pathname.includes('youth-football');
      const filteredCategories = (selectedSeasonType === 'youth' && currentIsYouth) || (selectedSeasonType === 'senior' && !currentIsYouth)
        ? data?.filter((category: any) => category.id !== currentCategoryId) || []
        : data || [];
      
      setCategories(filteredCategories);
    };

    fetchCategories();
  }, [selectedSeasonId, selectedSeasonType, currentCategoryId]);

  const handleTransfer = async () => {
    if (!selectedCategoryId || !selectedSeasonType) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Por favor selecciona una categoría",
      });
      return;
    }

    setIsLoading(true);

    try {
      // First get the player's data
      const { data: playerData, error: playerError } = await supabase
        .from("players")
        .select("*")
        .eq("id", playerId)
        .single();

      if (playerError) throw playerError;

      // Remove fields that should not be copied
      const { 
        id, 
        user_id, 
        created_at, 
        ...playerDataToCopy 
      } = playerData;

      // Prepare the new player record based on the destination type
      const newPlayerData = {
        ...playerDataToCopy,
        user_id: null, // Remove user_id to avoid duplicate key error
        email: null, // Clear email to avoid unique constraint conflicts on copy
        is_auth_enabled: false, // Disable auth for the copied player
        category_id: selectedSeasonType === 'youth' ? selectedCategoryId : null,
        senior_category_id: selectedSeasonType === 'senior' ? selectedCategoryId : null,
        created_at: new Date().toISOString(),
      };

      const { data: newPlayer, error: createError } = await supabase
        .from("players")
        .insert(newPlayerData)
        .select()
        .single();

      if (createError) throw createError;

      // Create assignment for the new player copy
      const assignmentData = {
        player_id: newPlayer.id,
        category_id: selectedSeasonType === 'youth' ? selectedCategoryId : null,
        senior_category_id: selectedSeasonType === 'senior' ? selectedCategoryId : null,
        season_id: selectedSeasonType === 'youth' ? selectedSeasonId : null,
        senior_season_id: selectedSeasonType === 'senior' ? selectedSeasonId : null,
        start_date: new Date().toISOString(),
      };

      const { error: assignmentError } = await supabase
        .from("player_category_assignments")
        .insert(assignmentData);

      if (assignmentError) throw assignmentError;

      toast({
        title: "Éxito",
        description: "Jugador copiado correctamente a la nueva categoría",
      });

      onTransfer();
      onClose();
    } catch (error) {
      console.error("Copy error:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo copiar al jugador",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset category selection when season changes
  const handleSeasonChange = (value: string) => {
    // Value format: "seasonId|type"
    const [seasonId, seasonType] = value.split('|');
    setSelectedSeasonId(seasonId);
    setSelectedSeasonType(seasonType as 'youth' | 'senior');
    setSelectedCategoryId("");
  };

  const { getGradientClasses } = useOrganizationTheme();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar Jugador</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Seleccionar Temporada</label>
            <Select
              value={selectedSeasonId ? `${selectedSeasonId}|${selectedSeasonType}` : ""}
              onValueChange={handleSeasonChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar temporada" />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((season: any) => (
                  <SelectItem key={`${season.id}|${season.type}`} value={`${season.id}|${season.type}`}>
                    {season.name} {season.type === 'senior' ? '(Primer Equipo)' : '(Fútbol Joven)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSeasonId && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Seleccionar Categoría</label>
              <Select
                value={selectedCategoryId}
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleTransfer} 
            disabled={isLoading || !selectedCategoryId}
            className={`bg-gradient-to-br ${getGradientClasses('primary')} ${getGradientClasses('hover')} text-primary-foreground border border-border hover:shadow-lg`}
          >
            {isLoading ? "Copiando..." : "Copiar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}