import React, { useState, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useSafeDynamic } from '../context/DynamicIntegration';
import { AvatarCharacter } from './AvatarCharacter';
import { sounds } from '../utils/audio';

export type SettingsTabId = 'profile' | 'profile_settings' | 'notifications' | 'private_key' | 'referrals';

interface SettingsOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTabId;
}

export const openSettingsModal = (tab: SettingsTabId = 'profile') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('proprush_open_settings', { detail: { tab } }));
  }
};

export const SettingsOptionsModal: React.FC<SettingsOptionsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'profile',
}) => {
  const { user, updateUser, updateUsername } = useUser();
  const { isLight } = useTheme();
  const { primaryWallet, user: dynamicUser, setShowDynamicUserProfile, isAuthenticated: isDynamicSignedIn } = useSafeDynamic();

  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  // Form states for Profile Settings
  const [usernameInput, setUsernameInput] = useState(user.username || '');
  const [firstNameInput, setFirstNameInput] = useState(user.firstName || '');
  const [lastNameInput, setLastNameInput] = useState(user.lastName || '');
  const [bioInput, setBioInput] = useState(user.bio || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || 'orange');

  // Inline edit state in Profile overview tab
  const [isInlineEditingUsername, setIsInlineEditingUsername] = useState(false);
  const [inlineUsername, setInlineUsername] = useState(user.username || '');

  // Status & copy feedback
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedRefLink, setCopiedRefLink] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [privateKeyExportActive, setPrivateKeyExportActive] = useState(false);

  // Notifications toggles
  const [soundFxEnabled, setSoundFxEnabled] = useState(true);
  const [turnTimerAlerts, setTurnTimerAlerts] = useState(true);
  const [matchInviteAlerts, setMatchInviteAlerts] = useState(true);

  // Sync inputs when user changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setUsernameInput(user.username || '');
      setInlineUsername(user.username || '');
      setFirstNameInput(user.firstName || '');
      setLastNameInput(user.lastName || '');
      setBioInput(user.bio || '');
      setSelectedAvatar(user.avatar || 'orange');
      setSaveSuccessMsg(null);
      setPrivateKeyExportActive(false);
    }
  }, [isOpen, initialTab, user]);

  if (!isOpen) return null;

  const walletAddress = primaryWallet?.address || user.walletAddress || '0x71C...4e92';
  const effectiveEmail = (isDynamicSignedIn && (dynamicUser?.email || dynamicUser?.verifiedCredentials?.find((c: any) => c.format === 'email')?.email)) || user.email;

  const handleCopyAddress = () => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(walletAddress).catch(() => {});
      }
    } catch {}
    setCopiedAddress(true);
    sounds.playClick();
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const handleCopyRef = () => {
    try {
      const link = `${window.location.origin}/?ref=${encodeURIComponent(user.username)}`;
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(link).catch(() => {});
      }
    } catch {}
    setCopiedRefLink(true);
    sounds.playClick();
    setTimeout(() => setCopiedRefLink(false), 2000);
  };

  const handleSaveInlineUsername = () => {
    const trimmed = inlineUsername.trim();
    if (trimmed && trimmed.length >= 2) {
      updateUsername(trimmed);
      updateUser({ username: trimmed });
      setUsernameInput(trimmed);
      setIsInlineEditingUsername(false);
      sounds.playClick();
    }
  };

  const handleSaveFullProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = usernameInput.trim() || user.username || 'Player';
    const cleanFirst = firstNameInput.trim();
    const cleanLast = lastNameInput.trim();
    const cleanBio = bioInput.trim();

    updateUsername(cleanUsername);
    updateUser({
      username: cleanUsername,
      firstName: cleanFirst,
      lastName: cleanLast,
      bio: cleanBio,
      avatar: selectedAvatar,
    });

    sounds.playWin();
    setSaveSuccessMsg('Profile settings saved successfully!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleStartExportPrivateKey = () => {
    sounds.playClick();
    setPrivateKeyExportActive(true);
    // Trigger the Dynamic SDK native profile view where users export private keys & credentials
    try {
      setShowDynamicUserProfile(true);
    } catch (e) {
      console.warn('Dynamic user profile trigger error:', e);
    }
  };

  const navItems = [
    { id: 'profile' as SettingsTabId, label: 'Profile', icon: '👤' },
    { id: 'profile_settings' as SettingsTabId, label: 'Profile settings', icon: '⚙️' },
    { id: 'notifications' as SettingsTabId, label: 'Notifications', icon: '🔔' },
    { id: 'private_key' as SettingsTabId, label: 'Private key', icon: '🔑' },
    { id: 'referrals' as SettingsTabId, label: 'Referral Program', icon: '🎁' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className={`w-full max-w-4xl h-[92vh] sm:h-[680px] max-h-[720px] rounded-3xl border shadow-2xl flex flex-col md:flex-row overflow-hidden transition-colors ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#15102a] border-[#2f2552] text-slate-100'
        }`}
      >
        {/* LEFT COLUMN: NAVIGATION TABS */}
        <aside
          className={`w-full md:w-64 border-b md:border-b-0 md:border-r p-4 sm:p-5 flex flex-col justify-between shrink-0 ${
            isLight ? 'bg-slate-50/80 border-slate-200' : 'bg-[#110d24] border-[#261e44]'
          }`}
        >
          <div>
            {/* Modal Header Badge */}
            <div className="flex items-center justify-between md:justify-start gap-2.5 mb-5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7059e2] to-indigo-500 flex items-center justify-center text-white text-base shadow-md">
                ⚡
              </div>
              <div>
                <h2 className="font-heading font-black text-base tracking-wide leading-tight">Settings & Options</h2>
                <p className="text-[11px] text-slate-400 font-medium">Dynamic Web3 & Profile</p>
              </div>
              <button
                onClick={onClose}
                className="md:hidden text-slate-400 hover:text-white p-1 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Nav Tabs List */}
            <nav className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
              {navItems.map(item => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      sounds.playClick();
                      setActiveTab(item.id);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all text-left cursor-pointer ${
                      isActive
                        ? isLight
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                          : 'bg-[#7059e2] text-white shadow-lg shadow-[#7059e2]/30 font-extrabold'
                        : isLight
                        ? 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                        : 'text-slate-400 hover:bg-[#1f183d] hover:text-slate-200'
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Dynamic Status Footer */}
          <div className={`hidden md:block p-3 rounded-2xl border text-xs ${
            isLight ? 'bg-white border-slate-200 text-slate-600' : 'bg-[#181333] border-[#292049] text-slate-400'
          }`}>
            <div className="flex items-center gap-1.5 font-bold text-[11px] text-emerald-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Dynamic Connected
            </div>
            <p className="font-mono text-[10px] truncate text-slate-500">{walletAddress}</p>
          </div>
        </aside>

        {/* RIGHT COLUMN: ACTIVE TAB CONTENT */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Top close button on desktop */}
          <div className="hidden md:flex items-center justify-end p-4 pb-0 shrink-0 z-10">
            <button
              onClick={onClose}
              className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
                  : 'bg-[#1a1436] hover:bg-[#251d4d] border-[#2e2454] text-slate-300 hover:text-white'
              }`}
              title="Close Settings"
            >
              ✕ Esc
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
            {/* TAB 1: PROFILE OVERVIEW */}
            {activeTab === 'profile' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h3 className="font-heading font-black text-xl sm:text-2xl tracking-tight">Profile</h3>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Overview of your tycoon identity and verified Web3 connection.
                  </p>
                </div>

                {/* Account Card Banner */}
                <div className={`p-4 sm:p-5 rounded-2xl border flex items-center gap-4 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1a1435] border-[#2b224e]'
                }`}>
                  <div className="relative shrink-0">
                    <AvatarCharacter avatarId={user.avatar} frameId={user.avatarFrame} size="lg" />
                    <div className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-[#7059e2] text-[10px] font-mono font-bold text-white">
                      LV{user.level}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-heading font-black text-lg truncate">{user.username}</h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7059e2]/20 text-[#a594fd] border border-[#7059e2]/30">
                        {user.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono-code truncate">{effectiveEmail}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs">
                      <span className="font-semibold text-amber-400 font-mono-code">${user.walletBalance.toFixed(2)} USD</span>
                      <span className="text-slate-500">•</span>
                      <span className="font-semibold text-indigo-300">{user.coins} 🪙 Coins</span>
                    </div>
                  </div>
                </div>

                {/* ACCOUNT INFORMATION & IDENTIFIERS */}
                <div className={`p-5 rounded-2xl border space-y-5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#171230] border-[#29204a]'
                }`}>
                  <h4 className="font-heading font-bold text-sm uppercase tracking-wider text-slate-400">
                    Account Information
                  </h4>

                  {/* 1. ETHEREUM WALLET ADDRESS (CANNOT BE EDITED) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold flex items-center gap-1.5 text-slate-300">
                        <span>Ethereum Wallet Address</span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          🔒 Cannot be edited
                        </span>
                      </label>
                      <button
                        onClick={handleCopyAddress}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                          copiedAddress
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                      >
                        {copiedAddress ? 'Copied ✓' : 'Copy Address'}
                      </button>
                    </div>

                    <div className={`p-3 rounded-xl border font-mono text-xs select-all break-all ${
                      isLight ? 'bg-slate-100/90 text-slate-700 border-slate-200' : 'bg-[#0f0b20] text-indigo-200 border-[#241c42]'
                    }`}>
                      {walletAddress}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Your cryptographic wallet address is tied to your Dynamic Web3 account and cannot be modified.
                    </p>
                  </div>

                  <div className="h-px bg-slate-800/40 w-full" />

                  {/* 2. USERNAME (EDITABLE RIGHT BELOW ADDRESS) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <span>Player Username</span>
                        <span className="text-[10px] text-emerald-400 font-semibold">• Editable</span>
                      </label>
                      {!isInlineEditingUsername ? (
                        <button
                          onClick={() => {
                            setInlineUsername(user.username);
                            setIsInlineEditingUsername(true);
                          }}
                          className="text-xs font-bold text-[#a594fd] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                        >
                          ✏️ Edit Username
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSaveInlineUsername}
                            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsInlineEditingUsername(false)}
                            className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {isInlineEditingUsername ? (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">@</span>
                          <input
                            type="text"
                            value={inlineUsername}
                            onChange={e => setInlineUsername(e.target.value)}
                            className={`w-full pl-7 pr-3 py-2 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#7059e2] ${
                              isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#0f0b20] border-[#372b61] text-white'
                            }`}
                            placeholder="Enter username"
                            autoFocus
                          />
                        </div>
                      </div>
                    ) : (
                      <div className={`p-3 rounded-xl border text-sm font-bold flex items-center justify-between ${
                        isLight ? 'bg-slate-100 text-slate-800 border-slate-200' : 'bg-[#0f0b20] text-white border-[#241c42]'
                      }`}>
                        <span className="font-mono text-indigo-300">@{user.username}</span>
                        <span className="text-xs text-slate-500 font-normal">Visible to all players</span>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-slate-800/40 w-full" />

                  {/* 3. PROFILE FIELDS: FIRST NAME, LAST NAME, BIO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs text-slate-400 font-medium">First Name</span>
                      <p className="text-sm font-bold mt-0.5 text-slate-200">{user.firstName || '—'}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-medium">Last Name</span>
                      <p className="text-sm font-bold mt-0.5 text-slate-200">{user.lastName || '—'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-xs text-slate-400 font-medium">Bio</span>
                      <p className="text-xs font-medium mt-1 text-slate-300 leading-relaxed italic bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50">
                        {user.bio || 'No personal bio added yet. Click "Edit Profile Settings" below to introduce yourself to fellow tycoons!'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        sounds.playClick();
                        setActiveTab('profile_settings');
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-[#7059e2]/20 hover:bg-[#7059e2]/30 border border-[#7059e2]/40 text-[#c2b6ff] font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>⚙️</span>
                      <span>Edit Full Profile Settings (Name, Bio, Avatar)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PROFILE SETTINGS (FULL FORM) */}
            {activeTab === 'profile_settings' && (
              <form onSubmit={handleSaveFullProfile} className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="font-heading font-black text-xl sm:text-2xl tracking-tight">Profile Settings</h3>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Customize your username, personal name, and player biography.
                  </p>
                </div>

                {saveSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-pulse">
                    <span>✓</span> {saveSuccessMsg}
                  </div>
                )}

                {/* Avatar Preview & Selection */}
                <div className={`p-4 rounded-2xl border space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#171230] border-[#29204a]'
                }`}>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Avatar Character
                  </label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <AvatarCharacter avatarId={selectedAvatar} frameId={user.avatarFrame} size="md" />
                    <div className="flex gap-2 flex-wrap">
                      {['orange', 'navy', 'fire', 'apple', 'lilac', 'emerald'].map(avId => (
                        <button
                          key={avId}
                          type="button"
                          onClick={() => {
                            sounds.playClick();
                            setSelectedAvatar(avId);
                          }}
                          className={`w-10 h-10 rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
                            selectedAvatar === avId
                              ? 'border-[#7059e2] scale-110 shadow-md shadow-[#7059e2]/30'
                              : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <AvatarCharacter avatarId={avId} size="sm" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Username Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Username <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">@</span>
                    <input
                      type="text"
                      required
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value)}
                      className={`w-full pl-7 pr-3 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#7059e2] ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f0b20] border-[#372b61] text-white'
                      }`}
                      placeholder="e.g. SatoshiTycoon"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    This is your unique display name in multiplayer rooms and global leaderboards.
                  </p>
                </div>

                {/* First Name & Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">First Name</label>
                    <input
                      type="text"
                      value={firstNameInput}
                      onChange={e => setFirstNameInput(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7059e2] ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f0b20] border-[#372b61] text-white'
                      }`}
                      placeholder="e.g. John"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300">Last Name</label>
                    <input
                      type="text"
                      value={lastNameInput}
                      onChange={e => setLastNameInput(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#7059e2] ${
                        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f0b20] border-[#372b61] text-white'
                      }`}
                      placeholder="e.g. Doe"
                    />
                  </div>
                </div>

                {/* Bio Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300">Bio</label>
                    <span className="text-[11px] text-slate-500">{bioInput.length} / 180</span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={180}
                    value={bioInput}
                    onChange={e => setBioInput(e.target.value)}
                    className={`w-full p-3 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#7059e2] resize-none ${
                      isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#0f0b20] border-[#372b61] text-white'
                    }`}
                    placeholder="Tell other tycoons about your real estate strategies, Web3 holdings, or favorite board themes..."
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setUsernameInput(user.username || '');
                      setFirstNameInput(user.firstName || '');
                      setLastNameInput(user.lastName || '');
                      setBioInput(user.bio || '');
                      setSelectedAvatar(user.avatar || 'orange');
                    }}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#7059e2] to-indigo-600 hover:from-[#5d44db] hover:to-indigo-500 text-white font-heading font-black text-xs shadow-lg shadow-[#7059e2]/30 transition-all cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: NOTIFICATIONS */}
            {activeTab === 'notifications' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="font-heading font-black text-xl sm:text-2xl tracking-tight">Notifications</h3>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Configure audio chimes and game alerts during live matches.
                  </p>
                </div>

                <div className={`p-4 sm:p-5 rounded-2xl border divide-y ${
                  isLight ? 'bg-white border-slate-200 divide-slate-100' : 'bg-[#171230] border-[#29204a] divide-[#241c42]'
                }`}>
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold">Sound Effects & Dice Roll</h4>
                      <p className="text-xs text-slate-400">Play auditory feedback for moves, rent, and auctions</p>
                    </div>
                    <button
                      onClick={() => {
                        sounds.playClick();
                        setSoundFxEnabled(!soundFxEnabled);
                      }}
                      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                        soundFxEnabled ? 'bg-[#7059e2]' : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        soundFxEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold">Turn Timer Alerts</h4>
                      <p className="text-xs text-slate-400">Warning sound when your turn clock has less than 5 seconds</p>
                    </div>
                    <button
                      onClick={() => {
                        sounds.playClick();
                        setTurnTimerAlerts(!turnTimerAlerts);
                      }}
                      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                        turnTimerAlerts ? 'bg-[#7059e2]' : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        turnTimerAlerts ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold">Game Invites & Challenges</h4>
                      <p className="text-xs text-slate-400">Receive toasts when players share room codes</p>
                    </div>
                    <button
                      onClick={() => {
                        sounds.playClick();
                        setMatchInviteAlerts(!matchInviteAlerts);
                      }}
                      className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                        matchInviteAlerts ? 'bg-[#7059e2]' : 'bg-slate-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        matchInviteAlerts ? 'translate-x-6' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PRIVATE KEY (EXACT SCREEN REQUESTED) */}
            {activeTab === 'private_key' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="font-heading font-black text-xl sm:text-2xl tracking-tight">Export Private key</h3>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Exporting your private key gives you direct control and security over your funds. This is applicable if you've signed up via email.
                  </p>
                </div>

                {/* WARNING CALLOUT BOX */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
                  <span className="text-xl">⚠️</span>
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold text-amber-200">Do Not share your private key with anyone.</span> We will never ask for your private key. Anyone with this key has full control over all crypto assets inside this wallet.
                  </div>
                </div>

                {/* BASIC STEPS SECTION */}
                <div className={`p-5 rounded-2xl border space-y-3.5 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#171230] border-[#29204a]'
                }`}>
                  <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-400">
                    Basic steps
                  </h4>
                  <ol className="space-y-3 text-xs text-slate-300">
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#7059e2]/30 text-[#c2b6ff] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </span>
                      <span>Click the button below to start the process</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#7059e2]/30 text-[#c2b6ff] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </span>
                      <span>Go to settings and click on the <strong className="text-white">Account & Security</strong> button and then <strong className="text-white">Private Key</strong> Button to export your private key</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-[#7059e2]/30 text-[#c2b6ff] font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </span>
                      <span>Close the modal</span>
                    </li>
                  </ol>
                </div>

                {/* ACTION TRIGGER BUTTON */}
                <div className="pt-2">
                  <button
                    onClick={handleStartExportPrivateKey}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-heading font-black text-sm shadow-xl shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                  >
                    <span>🔑</span>
                    <span>Start export</span>
                  </button>
                </div>

                {privateKeyExportActive && (
                  <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs leading-relaxed space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-indigo-200">
                      <span>✓</span> Dynamic Security Modal launched
                    </div>
                    <p>
                      Follow the prompts inside the Dynamic window to view your recovery phrase or export your private key directly.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: REFERRAL PROGRAM */}
            {activeTab === 'referrals' && (
              <div className="space-y-5 animate-fade-in">
                <div>
                  <h3 className="font-heading font-black text-xl sm:text-2xl tracking-tight">Referral Program</h3>
                  <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    Invite friends to PropRush and earn 10% lifetime house rake rewards!
                  </p>
                </div>

                <div className={`p-5 rounded-2xl border space-y-4 ${
                  isLight ? 'bg-white border-slate-200' : 'bg-[#171230] border-[#29204a]'
                }`}>
                  <label className="text-xs font-bold text-slate-300">Your Shareable Referral Link</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?ref=${encodeURIComponent(user.username)}`}
                      className={`flex-1 px-3 py-2.5 rounded-xl border text-xs font-mono select-all ${
                        isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#0f0b20] border-[#2c2350] text-indigo-300'
                      }`}
                    />
                    <button
                      onClick={handleCopyRef}
                      className="px-4 py-2.5 rounded-xl bg-[#7059e2] hover:bg-[#5d44db] text-white font-bold text-xs cursor-pointer shrink-0"
                    >
                      {copiedRefLink ? 'Copied ✓' : 'Copy Link'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                      <span className="text-[11px] text-slate-400">Friends Joined</span>
                      <p className="font-heading font-black text-lg text-white mt-0.5">0</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                      <span className="text-[11px] text-slate-400">Earnings Collected</span>
                      <p className="font-heading font-black text-lg text-amber-400 mt-0.5">$0.00</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
