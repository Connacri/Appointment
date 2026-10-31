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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  EstablishmentProfile,
  EstablishmentType,
  DEFAULT_ESTABLISHMENT_PROFILE,
} from '../types/establishment';
import { PRESET_HOTEL_LOGOS } from '../utils/establishmentDefaults';
import { playSuccessFeedback, playClickFeedback } from '../utils/audioFeedback';

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
  const { establishmentProfile, setEstablishmentProfile, language, currency, setCurrency } = useApp();

  const [activeTab, setActiveTab] = useState<'identity' | 'logo' | 'contact' | 'fiscal'>('identity');
  const [formData, setFormData] = useState<EstablishmentProfile>(() => {
    return establishmentProfile || DEFAULT_ESTABLISHMENT_PROFILE;
  });

  const [customLogoPreview, setCustomLogoPreview] = useState<string>(
    establishmentProfile?.logoUrl || PRESET_HOTEL_LOGOS[0].svgDataUrl
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      className="fixed inset-0 z-[10002] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="establishment-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/60 via-indigo-50/40 to-transparent dark:from-blue-950/30 dark:via-slate-900 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="establishment-modal-title" className="text-base font-extrabold text-slate-900 dark:text-white">
                  {isFirstLaunch
                    ? "Bienvenue sur OmniBook — Configuration de votre Établissement"
                    : "Paramètres de l'Établissement & Coordonnées de Facturation"}
                </h2>
                {isFirstLaunch && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    1ère Ouverture
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ces coordonnées et votre logo seront automatiquement utilisés sur vos devis, factures officielles et documents d'accueil.
              </p>
            </div>
          </div>

          {!isFirstLaunch && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 bg-slate-50/70 dark:bg-slate-850/50 gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'identity', label: '1. Identité & Type', icon: Building2 },
            { id: 'logo', label: '2. Logo & Visuel', icon: ImageIcon },
            { id: 'contact', label: '3. Adresse & Contact', icon: MapPin },
            { id: 'fiscal', label: '4. Fiscalité & RIB Bancaire', icon: Landmark },
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
                className={`py-3 px-3.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
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
                        className="p-1 text-slate-300 hover:text-amber-400 transition-colors"
                      >
                        <Star
                          size={18}
                          className={star <= formData.stars ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}
                        />
                      </button>
                    ))}
                    <span className="ml-2 font-bold text-slate-700 dark:text-slate-300 text-xs">
                      {formData.stars === 5 ? '5 Étoiles (Palace / Luxe)' : `${formData.stars} Étoiles`}
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

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Données conservées en local et synchronisées avec vos factures</span>
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
