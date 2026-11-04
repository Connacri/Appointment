/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * EstablishmentSetupModal
 * Fenêtre de configuration & onboarding de l'hôtel / établissement touristique.
 * - S'ouvre à la 1ère ouverture de l'application si l'établissement n'est pas encore personnalisé
 * - Accessible et rééditable à tout moment (TopBar, Facturation, Paramètres)
 * - Coordonnées, Type, Logo (Upload image ou Préréglages vectoriels), NIF/RC/RIB pour les Factures et Devis
 */

import React, { useState, useRef } from 'react';
import {
  Building2,
  Upload,
  Star,
  MapPin,
  Phone,
  Mail,
  Globe,
  FileSpreadsheet,
  Landmark,
  CheckCircle2,
  Sparkles,
  X,
  Image as ImageIcon,
  Check,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  Layers,
  Plus,
  Database,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  EstablishmentProfile,
  EstablishmentType,
  DEFAULT_ESTABLISHMENT_PROFILE,
} from '../types/establishment';
import { PRESET_HOTEL_LOGOS } from '../utils/establishmentDefaults';
import { playSuccessFeedback, playClickFeedback } from '../utils/audioFeedback';
import { lockManager } from '../locks/lockManager';
import { mdbSnapshotToPlanning, type MdbTableSummary } from '../locks/database/mdbImport';
import { generateHotelFloorRooms } from '../utils/hotelStructure';
import { discoverNativeCardLockFiles, isNativeDesktop, pickNativeCardLockFile, readDiscoveredCardLock } from '../services/desktopRuntime';

interface EstablishmentSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstLaunch?: boolean;
}

export const EstablishmentSetupModal: React.FC<EstablishmentSetupModalProps> = ({
  isOpen,
  onClose,
  isFirstLaunch = false,
}) => {
  const { establishmentProfile, setEstablishmentProfile, language, currency, setCurrency, resourceGroups, setResourceGroups, setBookings, setSelectedEstablishmentId } = useApp();

  const [activeTab, setActiveTab] = useState<'identity' | 'logo' | 'contact' | 'fiscal' | 'structure'>('identity');
  const [formData, setFormData] = useState<EstablishmentProfile>(() => {
    return establishmentProfile || DEFAULT_ESTABLISHMENT_PROFILE;
  });

  const [customLogoPreview, setCustomLogoPreview] = useState<string>(
    establishmentProfile?.logoUrl || PRESET_HOTEL_LOGOS[0].svgDataUrl
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdbInputRef = useRef<HTMLInputElement>(null);
  const [buildingName, setBuildingName] = useState('Bâtiment principal');
  const [buildingNo, setBuildingNo] = useState('1');
  const [floorNo, setFloorNo] = useState('1');
  const [roomPrefix, setRoomPrefix] = useState('1');
  const [roomStart, setRoomStart] = useState('01');
  const [roomEnd, setRoomEnd] = useState('30');
  const [excludedRoomNumbers, setExcludedRoomNumbers] = useState('13');
  const [tableInventory, setTableInventory] = useState<MdbTableSummary[]>([]);
  const [structureMessage, setStructureMessage] = useState('');
  const [isImportingMdb, setIsImportingMdb] = useState(false);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("L'image ne doit pas dépasser 2 Mo pour des performances optimales.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setCustomLogoPreview(result);
        setFormData((prev) => ({ ...prev, logoUrl: result }));
        playClickFeedback();
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetLogo = (dataUrl: string) => {
    setCustomLogoPreview(dataUrl);
    setFormData((prev) => ({ ...prev, logoUrl: dataUrl }));
    playClickFeedback();
  };

  const handleCreateRooms = () => {
    try {
      const bNo = Number(buildingNo);
      const fNo = Number(floorNo);
      const existing = resourceGroups.find((group) => group.id === `manual-building-${bNo}` || group.id === `mdb-bld-${bNo}`);
      const result = generateHotelFloorRooms({
        buildingNumber: bNo,
        floorNumber: fNo,
        prefix: roomPrefix.trim(),
        start: Number(roomStart),
        end: Number(roomEnd),
        padWidth: roomStart.length,
        excludedFloorNumbers: excludedRoomNumbers.split(',').map((value) => value.trim()).filter(Boolean),
        existingNames: existing?.resources.map((room) => room.name) ?? [],
      });
      if (!buildingName.trim()) throw new Error('Saisissez le nom du bâtiment.');
      if (result.rooms.length === 0) {
        setStructureMessage(`Aucune chambre créée. ${result.excluded.length} numéro(s) exclu(s), ${result.duplicates.length} doublon(s).`);
        return;
      }
      const preview = result.rooms.slice(0, 8).map((room) => room.name).join(', ');
      const more = result.rooms.length > 8 ? ', …' : '';
      const summary = `Bâtiment : ${buildingName} (n° ${bNo})\\nÉtage : ${fNo}\\nChambres : ${result.rooms.length}\\nAperçu : ${preview}${more}\\nExclus : ${result.excluded.length}\\nDoublons ignorés : ${result.duplicates.length}\\n\\nConfirmer la création de ces chambres ?`;
      if (!window.confirm(summary)) return;
      const nextGroup = {
        id: existing?.id ?? `manual-building-${bNo}`,
        name: existing?.name ?? { fr: buildingName.trim(), en: buildingName.trim(), ar: buildingName.trim() },
        sector: 'hotel' as const,
        icon: 'Building',
        resources: [...(existing?.resources || []), ...result.rooms],
      };
      setResourceGroups((prev) => existing
        ? prev.map((group) => group.id === nextGroup.id ? nextGroup : group)
        : [...prev, nextGroup]);
      const excluded = result.excluded.length ? ` Numéros exclus : ${result.excluded.join(', ')}.` : '';
      const duplicates = result.duplicates.length ? ` Doublons ignorés : ${result.duplicates.join(', ')}.` : '';
      setStructureMessage(`${result.rooms.length} chambre(s) ajoutée(s) dans ${buildingName}, étage ${fNo}.${excluded}${duplicates}`);
      playSuccessFeedback();
    } catch (error) {
      setStructureMessage(error instanceof Error ? error.message : 'Paramètres de numérotation invalides.');
    }
  };

  const applyMdbFile = async (file: File) => {
    setIsImportingMdb(true);
    setStructureMessage('');
    try {
      const snapshot = await lockManager.importMdb(file);
      const planning = mdbSnapshotToPlanning(snapshot);
      const existingHotelRooms = resourceGroups.filter((group) => group.sector === 'hotel')
        .reduce((count, group) => count + group.resources.length, 0);
      if (existingHotelRooms > 0 && !window.confirm(
        `La base CardLock contient ${snapshot.counts.rooms} chambres et ${snapshot.buildings.length} bâtiment(s). Remplacer la structure hôtelière actuelle (${existingHotelRooms} chambres) par celle de CardLock ? Les autres secteurs seront conservés.`
      )) return;

      setResourceGroups((current) => [
        ...current.filter((group) => group.sector !== 'hotel'),
        ...planning.resourceGroups,
      ]);
      setSelectedEstablishmentId('all');
      if (planning.bookings.length) setBookings((prev) => {
        const importedIds = new Set(planning.bookings.map((booking) => booking.id));
        return [...prev.filter((booking) => !importedIds.has(booking.id)), ...planning.bookings];
      });
      setTableInventory(snapshot.tableInventory ?? []);
      const tableSummary = (snapshot.tableInventory ?? [])
        .map((table) => `${table.name} (${table.rowCount})`)
        .join(', ');
      setStructureMessage(
        `Import CardLock terminé : ${snapshot.counts.rooms} chambres, ${snapshot.buildings.length} bâtiment(s), ${snapshot.counts.guests} séjour(s), ${snapshot.counts.cards} carte(s). ${snapshot.tableInventory?.length ?? 0} table(s) lue(s) : ${tableSummary}.${snapshot.warnings.length ? ' Avertissements : ' + snapshot.warnings.join(' ') : ''}`
      );
      playSuccessFeedback();
    } catch (error) {
      setStructureMessage(`Échec de l’import : ${error instanceof Error ? error.message : 'fichier illisible'}`);
    } finally {
      setIsImportingMdb(false);
    }
  };

  const handleMdbImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await applyMdbFile(file);
    event.target.value = '';
  };

  const handleChooseCardLock = async () => {
    if (!isNativeDesktop()) {
      mdbInputRef.current?.click();
      return;
    }
    try {
      const candidates = await discoverNativeCardLockFiles();
      if (candidates.length) {
        const newest = [...candidates].sort((a, b) => (b.modifiedUnixMs ?? 0) - (a.modifiedUnixMs ?? 0))[0];
        const modified = newest.modifiedUnixMs ? new Date(newest.modifiedUnixMs).toLocaleString() : 'date inconnue';
        if (window.confirm(`Une base CardLock a été détectée :\n${newest.path}\nDernière modification : ${modified}\n\nImporter cette base ?`)) {
          await applyMdbFile(await readDiscoveredCardLock(newest));
          return;
        }
      }
      const selected = await pickNativeCardLockFile();
      if (selected) await applyMdbFile(selected);
    } catch (error) {
      setStructureMessage(error instanceof Error ? error.message : 'Impossible d’ouvrir CardLock.mdb.');
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: EstablishmentProfile = {
      ...formData,
      logoUrl: customLogoPreview,
      updatedAt: new Date().toISOString(),
    };

    setEstablishmentProfile(updated);
    if (updated.defaultCurrency && updated.defaultCurrency !== currency) {
      setCurrency(updated.defaultCurrency);
    }

    localStorage.setItem('omnibook_onboarding_completed', 'true');
    playSuccessFeedback();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[30000] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="establishment-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-transparent dark:from-blue-950/30 dark:via-slate-900 dark:to-transparent shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Building2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="establishment-modal-title" className="text-xs sm:text-base leading-snug font-extrabold text-slate-900 dark:text-white">
                  {isFirstLaunch
                    ? "Configuration Établissement"
                    : "Paramètres & Coordonnées Établissement"}
                </h2>
                {isFirstLaunch && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    · 1ère Ouverture
                  </span>
                )}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400">
                Coordonnées et logo pour factures officielles et documents d'accueil.
              </p>
            </div>
          </div>

          {!isFirstLaunch && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-2 sm:px-6 bg-slate-50/70 dark:bg-slate-850/50 gap-1 sm:gap-2 overflow-x-auto text-xs font-semibold no-scrollbar shrink-0">
          {[
            { id: 'identity', label: '1. Identité', fullLabel: '1. Identité & Type', icon: Building2 },
            { id: 'logo', label: '2. Logo', fullLabel: '2. Logo & Visuel', icon: ImageIcon },
            { id: 'contact', label: '3. Contact', fullLabel: '3. Adresse & Contact', icon: MapPin },
            { id: 'fiscal', label: '4. Fiscalité', fullLabel: '4. Fiscalité & RIB Bancaire', icon: Landmark },
            { id: 'structure', label: '5. Chambres', fullLabel: '5. Bâtiments & Chambres', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as any);
                  playClickFeedback();
                }}
                className={`py-2.5 sm:py-3 px-2 sm:px-3 border-b-2 flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={14} />
                <span className="sm:hidden">{tab.label}</span>
                <span className="hidden sm:inline">{tab.fullLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* TAB 1: IDENTITY & TYPE */}
          {activeTab === 'identity' && (
            <div className="space-y-5 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nom Officiel de l'Établissement *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex : Grand Hôtel Royal d'Oran, Resort des Palmiers"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Catégorie d'Établissement *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const type = e.target.value as EstablishmentType;
                      const typeLabel =
                        type === 'hotel'
                          ? "Hôtel de Tourisme & Séjour"
                          : type === 'resort'
                          ? "Complexe Touristique & Resort Balnéaire"
                          : type === 'boutique'
                          ? "Boutique Hôtel de Charme"
                          : type === 'business'
                          ? "Hôtel d'Affaires & Centre de Conférences"
                          : type === 'residence'
                          ? "Résidence Hôtelière & Suites Meublées"
                          : type === 'spa_clinic'
                          ? "Centre Thermal & Spa de Récupération"
                          : "Établissement Hôtelier";
                      setFormData({ ...formData, type, typeLabel });
                    }}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option value="hotel">Hôtel Classique / Hôtel de Ville</option>
                    <option value="resort">Complexe Touristique / Resort Balnéaire</option>
                    <option value="boutique">Boutique Hôtel / Établissement de Charme</option>
                    <option value="business">Hôtel d'Affaires & Congrès</option>
                    <option value="residence">Résidence Hôtelière / Appart'Hôtel</option>
                    <option value="spa_clinic">Spa de Séjour / Cure Thermale</option>
                    <option value="motel">Motel / Auberge</option>
                    <option value="other">Autre Établissement d'Hébergement</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sous-titre / Type visible sur facture
                  </label>
                  <input
                    type="text"
                    value={formData.typeLabel}
                    onChange={(e) => setFormData({ ...formData, typeLabel: e.target.value })}
                    placeholder="Ex : Hôtel 4 Étoiles & Spa"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Classification (Étoiles)
                  </label>
                  <div className="flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, stars: star });
                          playClickFeedback();
                        }}
                        aria-label={"Définir le classement à " + star + " étoile(s)"} aria-pressed={star === formData.stars} className="p-1 rounded-md hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      >
                        <Star
                          size={18}
                          className={star <= formData.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}
                        />
                      </button>
                    ))}
                    <span className="ml-2 font-bold text-slate-700 dark:text-slate-300 text-xs">
                      {formData.stars === 5 ? '5 étoiles' : `${formData.stars} étoiles`}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Devise de Facturation Principale
                  </label>
                  <select
                    value={formData.defaultCurrency}
                    onChange={(e) => setFormData({ ...formData, defaultCurrency: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="DA">Dinar Algérien (DA / DZD)</option>
                    <option value="€">Euro (€ / EUR)</option>
                    <option value="$">Dollar US ($ / USD)</option>
                    <option value="SAR">Riyal Saoudien (SAR)</option>
                    <option value="£">Livre Sterling (£ / GBP)</option>
                    <option value="CAD">Dollar Canadien (CAD)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Slogan ou Devise de l'Hôtel (Inclus en sous-titre)
                  </label>
                  <input
                    type="text"
                    value={formData.slogan || ''}
                    onChange={(e) => setFormData({ ...formData, slogan: e.target.value })}
                    placeholder="Ex : L'art de l'hospitalité méditerranéenne & du confort moderne"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 italic"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LOGO & VISUAL */}
          {activeTab === 'logo' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800">
                {/* Logo Preview */}
                <div className="relative w-28 h-28 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-blue-400 dark:border-blue-500/50 flex items-center justify-center p-2 shadow-inner shrink-0 overflow-hidden">
                  {customLogoPreview ? (
                    <img
                      src={customLogoPreview}
                      alt="Logo Aperçu"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <Building2 size={36} className="text-slate-400" />
                  )}
                </div>

                {/* Upload action */}
                <div className="space-y-2 text-center sm:text-left flex-1">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Téléversez le Logo Officiel de votre Établissement
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Formats acceptés : PNG, JPG, WebP ou SVG (fond transparent recommandé). Taille maximale : 2 Mo.
                    Ce logo s'affiche en grand sur l'en-tête de toutes vos factures et devis officiels.
                  </p>
                  <div className="pt-1 flex flex-wrap gap-2 justify-center sm:justify-start">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      <Upload size={14} />
                      <span>Choisir un fichier image</span>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Preset Logos library */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">
                    Ou choisissez un Blason Préconfiguré Haute Définition :
                  </h4>
                  <span className="text-[11px] text-slate-400">Prêt pour impression PDF</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PRESET_HOTEL_LOGOS.map((preset) => {
                    const isSelected = customLogoPreview === preset.svgDataUrl;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPresetLogo(preset.svgDataUrl)}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/40 shadow-xs ring-2 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800'
                        }`}
                      >
                        <img
                          src={preset.svgDataUrl}
                          alt={preset.name}
                          className="w-12 h-12 rounded-xl shrink-0 object-contain shadow-xs"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate text-xs">
                            {preset.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{preset.category}</p>
                        </div>
                        {isSelected && (
                          <div className="ml-auto w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACT & LOCATION */}
          {activeTab === 'contact' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Adresse physique complète *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Ex : 14 Boulevard Front de Mer, Les Falaises"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ville *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Ex : Oran"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Code Postal & Wilaya / Région
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formData.postalCode || ''}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      placeholder="31000"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={formData.region || ''}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                      placeholder="Wilaya d'Oran"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Pays *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    placeholder="Algérie, France, etc."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone Standard Principal *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+213 (0) 41 29 00 00"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone Mobile / Réception 24h
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneSecondary || ''}
                    onChange={(e) => setFormData({ ...formData, phoneSecondary: e.target.value })}
                    placeholder="+213 (0) 550 12 34 56"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    E-mail Officiel de Réservation & Factures *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="reservations@hotel-oran.com"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Site Web Officiel
                  </label>
                  <input
                    type="text"
                    value={formData.website || ''}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="www.grandhotel-oran.com"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: FISCAL & BANKING (INVOICES & QUOTES) */}
          {activeTab === 'fiscal' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl text-blue-900 dark:text-blue-300 leading-relaxed text-xs">
                Ces mentions légales obligatoires apparaitront dans le pied de page et les mentions fiscales de toutes vos <strong>factures</strong> et de vos <strong>devis</strong>, assurant une parfaite conformité comptable.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Numéro d'Identification Fiscale (NIF)
                  </label>
                  <input
                    type="text"
                    value={formData.taxNumber || ''}
                    onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
                    placeholder="Ex : 001231019000045"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Registre de Commerce (RC / SIRET)
                  </label>
                  <input
                    type="text"
                    value={formData.tradeRegisterNumber || ''}
                    onChange={(e) => setFormData({ ...formData, tradeRegisterNumber: e.target.value })}
                    placeholder="Ex : 31/00-1984250B20"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Numéro d'Identification Statistique (NIS)
                  </label>
                  <input
                    type="text"
                    value={formData.statisticalIdNumber || ''}
                    onChange={(e) => setFormData({ ...formData, statisticalIdNumber: e.target.value })}
                    placeholder="Ex : 099031010045678"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Article d'Imposition (AI)
                  </label>
                  <input
                    type="text"
                    value={formData.taxArticleNumber || ''}
                    onChange={(e) => setFormData({ ...formData, taxArticleNumber: e.target.value })}
                    placeholder="Ex : 31012450099"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="md:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                    <Landmark size={15} className="text-emerald-600" />
                    <span>Coordonnées Bancaires de l'Hôtel (Pour virement des clients)</span>
                  </h4>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Banque Domiciliataire
                  </label>
                  <input
                    type="text"
                    value={formData.bankName || ''}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    placeholder="Ex : Banque Nationale d'Algérie (BNA) - Agence Oran"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Relevé d'Identité Bancaire (RIB / IBAN)
                  </label>
                  <input
                    type="text"
                    value={formData.bankAccountRib || ''}
                    onChange={(e) => setFormData({ ...formData, bankAccountRib: e.target.value })}
                    placeholder="Ex : 001 00450 0200012345 67"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Code BIC / SWIFT (Pour règlements internationaux)
                  </label>
                  <input
                    type="text"
                    value={formData.bankSwift || ''}
                    onChange={(e) => setFormData({ ...formData, bankSwift: e.target.value })}
                    placeholder="Ex : BNALDZAL045"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Horaires Réception (Check-in / Check-out)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={formData.checkInTime}
                      onChange={(e) => setFormData({ ...formData, checkInTime: e.target.value })}
                      placeholder="Arrivée : 14:00"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                    <input
                      type="text"
                      value={formData.checkOutTime}
                      onChange={(e) => setFormData({ ...formData, checkOutTime: e.target.value })}
                      placeholder="Départ : 12:00"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BUILDINGS, FLOORS AND ROOMS */}
          {activeTab === 'structure' && (
            <div className="space-y-5 animate-in fade-in">
              <section className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200 font-extrabold text-sm">
                  <Database size={17} /> Importer la base proUSB CardLock.mdb
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Appointment Desktop peut détecter les chemins proUSB habituels et comparer leur date de modification. Dans le navigateur, sélectionnez le fichier manuellement. La copie VirtualStore peut être plus récente que celle de Program Files.
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
                  Cible habituelle : C:\Program Files (x86)\ProUSB SOFTWARE\proUSBHotelLockSystem\CardLock.mdb
                </p>
                <input ref={mdbInputRef} type="file" accept=".mdb,application/x-msaccess" onChange={handleMdbImport} className="hidden" />
                <button type="button" disabled={isImportingMdb} onClick={() => void handleChooseCardLock()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 disabled:opacity-60">
                  <Upload size={15} /> {isImportingMdb ? 'Analyse de la base en cours…' : 'Choisir CardLock.mdb'}
                </button>
                {(() => {
                  const status = lockManager.getMdbStatus();
                  return status.connected ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Base chargée : {status.source} — {status.rooms} chambres, {status.guests} séjours, {status.cards} cartes.</p>
                  ) : null;
                })()}
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
                <div className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-white text-sm">
                  <Building2 size={17} /> Créer la structure manuellement
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Créez un bâtiment, puis ajoutez ses étages. Définissez un préfixe (ex. 1), un début et une fin (ex. 01 à 30). Les numéros exclus sont appliqués à chaque étage ; le 13 est ignoré par défaut.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1"><span className="block font-semibold">Nom du bâtiment</span>
                    <input value={buildingName} onChange={(e) => setBuildingName(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="Bâtiment principal" />
                  </label>
                  <label className="space-y-1"><span className="block font-semibold">N° bâtiment</span>
                    <input type="number" min="1" value={buildingNo} onChange={(e) => setBuildingNo(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                  </label>
                  <label className="space-y-1"><span className="block font-semibold">Étage (0 = rez-de-chaussée)</span>
                    <input type="number" min="0" value={floorNo} onChange={(e) => setFloorNo(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                  </label>
                  <label className="space-y-1"><span className="block font-semibold">Préfixe facultatif</span>
                    <input value={roomPrefix} onChange={(e) => setRoomPrefix(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="Ex. A-" />
                  </label>
                  <label className="space-y-1"><span className="block font-semibold">Début de la plage (suffixe)</span>
                    <input type="text" inputMode="numeric" value={roomStart} onChange={(e) => setRoomStart(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                  </label>
                  <label className="space-y-1"><span className="block font-semibold">Fin de la plage (suffixe)</span>
                    <input type="text" inputMode="numeric" value={roomEnd} onChange={(e) => setRoomEnd(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" />
                  </label>
                  <label className="space-y-1 sm:col-span-2"><span className="block font-semibold">Numéros à exclure sur chaque étage (séparés par des virgules)</span>
                    <input value={excludedRoomNumbers} onChange={(e) => setExcludedRoomNumbers(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="13" />
                    <span className="block text-[11px] font-normal text-slate-500">Par défaut, le suffixe 13 est exclu : avec le préfixe 1, la chambre 113 n’est pas créée.</span>
                  </label>
                </div>
                <button type="button" onClick={handleCreateRooms} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2">
                  <Plus size={15} /> Créer les chambres
                </button>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Structure actuelle : {resourceGroups.filter((group) => group.sector === 'hotel').length} bâtiment(s), {resourceGroups.filter((group) => group.sector === 'hotel').reduce((total, group) => total + group.resources.length, 0)} chambre(s).
                </div>
              </section>

              {tableInventory.length > 0 && <section className="rounded-xl border border-emerald-200 dark:border-emerald-900 p-3 space-y-2"><h4 className="font-bold text-sm">Tables CardLock lues ({tableInventory.length})</h4><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{tableInventory.map((table) => <div key={table.name} className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2"><div className="flex justify-between gap-2"><span className="font-semibold">{table.name}</span><span className="tabular-nums">{table.rowCount} lignes</span></div><p className="mt-1 text-[10px] text-slate-500 break-words">{table.columns.join(' · ') || 'Aucune colonne lisible'}</p></div>)}</div></section>}
              {structureMessage && <div role="status" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 text-xs text-slate-700 dark:text-slate-200">{structureMessage}</div>}
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Données enregistrées localement. État de synchronisation affiché séparément.</span>
            </div>

            <div className="flex items-center gap-2">
              {isFirstLaunch && (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem('omnibook_onboarding_completed', 'true');
                    onClose();
                  }}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Découvrir avec le profil démo
                </button>
              )}

              <button
                type="submit"
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>Enregistrer & Appliquer à l'Établissement</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
