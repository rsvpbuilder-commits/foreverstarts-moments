import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { supabase } from '../lib/supabase';
import { theme, spacing, radius } from '../theme/colors';

const STATUS_META = {
  yes: { label: 'Attending', color: theme.success },
  pending: { label: 'Pending', color: theme.accentLight },
  no: { label: 'Declined', color: theme.error }
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'yes', label: 'Attending' },
  { key: 'pending', label: 'Pending' },
  { key: 'no', label: 'Declined' }
];

const normalizeStatus = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'yes' || raw === 'accepted' || raw === 'attending') {
    return 'yes';
  }
  if (raw === 'no' || raw === 'declined') {
    return 'no';
  }
  return 'pending';
};

const getPartySize = (entry) => {
  const candidates = [
    entry?.guest_count,
    entry?.rsvp_party_size,
    entry?.party_size,
    entry?.rsvp_count,
    entry?.guests_count
  ];
  const resolved = candidates.find((candidate) => {
    const parsed = Number(candidate);
    return Number.isFinite(parsed) && parsed > 0;
  });
  return resolved ? Math.round(Number(resolved)) : 1;
};

export default function RsvpManagerScreen({ guest, onClose }) {
  const isCouple = ['bride', 'groom'].includes(guest?.role);
  const [rsvps, setRsvps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [statusLoading, setStatusLoading] = useState({});
  const [guestNamesEditor, setGuestNamesEditor] = useState({ id: null, value: '' });
  const [guestNamesLoading, setGuestNamesLoading] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [exporting, setExporting] = useState(false);
  const handleClose = useCallback(() => {
    if (typeof onClose === 'function') {
      onClose();
    }
  }, [onClose]);

  const fetchRsvps = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
      setError('');
      try {
        const { data, error: queryError } = await supabase
          .from('responses')
          .select('id,name,status,message,guest_count,guest_names,created_at')
          .order('created_at', { ascending: false });
        if (queryError) throw queryError;
        setRsvps(data || []);
        setLastUpdated(new Date());
      } catch (err) {
        console.error('RSVP fetch failed', err);
        setError(
          'Unable to load RSVP responses right now. Please try again shortly.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchRsvps(false);
  }, [fetchRsvps]);

  const stats = useMemo(() => {
    return rsvps.reduce(
      (acc, entry) => {
        const status = normalizeStatus(entry?.status ?? entry?.rsvp_status);
        acc.total += 1;
        acc[status] += 1;
        const partySize = getPartySize(entry);
        if (status === 'yes') {
          acc.guests += partySize;
        }
        return acc;
      },
      { total: 0, yes: 0, pending: 0, no: 0, guests: 0 }
    );
  }, [rsvps]);

  const filteredRsvps = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rsvps.filter((entry) => {
      const status = normalizeStatus(entry?.status ?? entry?.rsvp_status);
      if (filter !== 'all' && status !== filter) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        entry?.name,
        entry?.guest_names,
        entry?.message
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [rsvps, filter, search]);

  const handleStatusChange = useCallback(
    async (guestId, nextStatus) => {
      if (!guestId || !isCouple) return;
      setStatusLoading((prev) => ({ ...prev, [guestId]: true }));
      setError('');
      try {
        const { error: updateError } = await supabase
          .from('responses')
          .update({ status: nextStatus })
          .eq('id', guestId);
        if (updateError) throw updateError;
        setRsvps((prev) =>
          prev.map((entry) =>
            entry.id === guestId
              ? { ...entry, status: nextStatus, rsvp_status: nextStatus }
              : entry
          )
        );
      } catch (err) {
        console.error('Status update failed', err);
        setError('Could not update this RSVP. Please try again.');
      } finally {
        setStatusLoading((prev) => ({ ...prev, [guestId]: false }));
      }
    },
    [isCouple]
  );

  const startGuestNamesEdit = useCallback(
    (entry) => {
      if (!isCouple || !entry?.id) return;
      setGuestNamesEditor({
        id: entry.id,
        value: entry?.guest_names?.toString().trim() || ''
      });
    },
    [isCouple]
  );

  const cancelGuestNamesEdit = useCallback(() => {
    setGuestNamesEditor({ id: null, value: '' });
  }, []);

  const handleGuestNamesDraftChange = useCallback((value) => {
    setGuestNamesEditor((prev) => (prev.id ? { ...prev, value } : prev));
  }, []);

  const handleGuestNamesSave = useCallback(async () => {
    const targetId = guestNamesEditor.id;
    if (!isCouple || !targetId) return;
    const normalized = guestNamesEditor.value
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .join(', ');
    setGuestNamesLoading((prev) => ({ ...prev, [targetId]: true }));
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('responses')
        .update({ guest_names: normalized })
        .eq('id', targetId);
      if (updateError) throw updateError;
      setRsvps((prev) =>
        prev.map((entry) =>
          entry.id === targetId
            ? { ...entry, guest_names: normalized }
            : entry
        )
      );
      setGuestNamesEditor({ id: null, value: '' });
    } catch (err) {
      console.error('Guest names update failed', err);
      setError('Unable to update the guest list. Please try again.');
    } finally {
      setGuestNamesLoading((prev) => ({ ...prev, [targetId]: false }));
    }
  }, [guestNamesEditor, isCouple]);

  const handleRefresh = () => fetchRsvps(true);
  const handleExportGuestList = useCallback(async () => {
    const attending = rsvps.filter(
      (entry) => normalizeStatus(entry?.status ?? entry?.rsvp_status) === 'yes'
    );
    if (!attending.length) {
      Alert.alert('No attendees yet', 'No attending RSVPs to export. Once guests say yes, you can download the list here.');
      return;
    }

    // Smart parsing that handles names with commas (e.g., "Last, First")
    // Uses party size to determine how to split
    const parseGuestNames = (rawValue, partySize) => {
      if (!rawValue) return [];
      const raw = rawValue.toString().trim();
      if (!raw) return [];

      // First try splitting by comma
      const commaSplit = raw.split(',').map((n) => n.trim()).filter(Boolean);
      
      // If comma split gives us exactly the party size or less, use it
      if (commaSplit.length <= partySize) {
        return commaSplit;
      }

      // If we have more items than party size, names likely contain commas
      // Try to intelligently merge them back
      // Look for patterns like "Lastname, Firstname" and merge them
      const merged = [];
      let i = 0;
      while (i < commaSplit.length && merged.length < partySize) {
        const current = commaSplit[i];
        const next = commaSplit[i + 1];
        
        // Check if this looks like "Lastname" followed by "Firstname"
        // (current is short, next exists and doesn't look like a full name)
        const currentLooksLikeLastName = current && !current.includes(' ') && current.length < 20;
        const nextLooksLikeFirstName = next && !next.includes(' ') && next.length < 20;
        
        if (currentLooksLikeLastName && nextLooksLikeFirstName && merged.length < partySize - 1) {
          // Merge as "Lastname, Firstname"
          merged.push(`${current}, ${next}`);
          i += 2;
        } else {
          merged.push(current);
          i += 1;
        }
      }

      // If merging still gives too many, just take first N based on party size
      return merged.slice(0, partySize);
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return dateStr;
      }
    };

    // Normalize name for comparison (lowercase, trim extra spaces)
    const normalizeName = (name) => (name || '').toLowerCase().trim().replace(/\s+/g, ' ');

    // Create comprehensive CSV with all guest details
    const csvRows = [
      [
        '#',
        'Guest Name',
        'RSVP Submitted By',
        'Party Size',
        'Message/Notes',
        'RSVP Date'
      ]
    ];
    
    let rowNumber = 1;
    let totalGuests = 0;

    attending.forEach((entry) => {
      const partySize = getPartySize(entry);
      const primaryName = entry?.name?.trim() || 'Unnamed Response';
      const guestNames = parseGuestNames(entry?.guest_names, partySize);
      const message = (entry?.message || entry?.rsvp_notes || entry?.notes || '').replace(/[\n\r]+/g, ' ').trim();
      const rsvpDate = formatDate(entry?.created_at);

      // Build unique list of guests for this RSVP
      const allNames = new Set();
      const uniqueGuests = [];
      const primaryNormalized = normalizeName(primaryName);

      // Check if primary name is already in guest_names
      const guestNamesNormalized = guestNames.map(normalizeName);
      const primaryInGuestNames = guestNamesNormalized.some(
        (n) => n === primaryNormalized || n.includes(primaryNormalized) || primaryNormalized.includes(n)
      );

      if (primaryInGuestNames && guestNames.length > 0) {
        // guest_names already contains primary - use it as the full list
        guestNames.forEach((name) => {
          const normalized = normalizeName(name);
          if (!allNames.has(normalized)) {
            allNames.add(normalized);
            uniqueGuests.push(name);
          }
        });
      } else {
        // Primary is not in guest_names, add primary first
        allNames.add(primaryNormalized);
        uniqueGuests.push(primaryName);
        
        // Then add other guest names
        guestNames.forEach((name) => {
          const normalized = normalizeName(name);
          if (!allNames.has(normalized)) {
            allNames.add(normalized);
            uniqueGuests.push(name);
          }
        });
      }

      // IMPORTANT: Party size is the authoritative count - never exceed it
      // Trim to party size if we have too many names
      const trimmedGuests = uniqueGuests.slice(0, partySize);

      // If we still need more guests to match party size, add unnamed placeholders
      const unnamedCount = Math.max(partySize - trimmedGuests.length, 0);
      for (let i = 0; i < unnamedCount; i += 1) {
        trimmedGuests.push(`Guest ${i + 1} of ${primaryName}`);
      }

      // Total guests = party size (authoritative)
      totalGuests += partySize;

      // Add each guest as a row (exactly partySize rows)
      trimmedGuests.forEach((guestName, index) => {
        csvRows.push([
          rowNumber.toString(),
          guestName,
          primaryName,
          index === 0 ? partySize.toString() : '', // Only show party size on first row
          index === 0 ? message : '', // Only show message on first row
          index === 0 ? rsvpDate : '' // Only show date on first row
        ]);
        rowNumber += 1;
      });
    });

    // Add summary section at the bottom
    csvRows.push([]);
    csvRows.push(['SUMMARY']);
    csvRows.push(['Total RSVPs', attending.length.toString()]);
    csvRows.push(['Total Guests', totalGuests.toString()]);
    csvRows.push(['Export Date', new Date().toLocaleString()]);

    const csvContent = csvRows
      .map((row) =>
        row
          .map((value) => {
            const normalized = (value ?? '').toString();
            const escaped = normalized.replace(/"/g, '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');

    try {
      setExporting(true);
      const timestamp = new Date();
      const fileName = `attending-guests-${timestamp.toISOString().slice(0, 10)}.csv`;

      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        Alert.alert('Export complete', `Exported ${totalGuests} guests from ${attending.length} RSVPs as ${fileName}.`);
      } else if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (!permissions.granted) {
          Alert.alert('Export cancelled', 'Storage permission is required to save the guest list.');
        } else {
          const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            fileName,
            'text/csv'
          );
          await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, csvContent, {
            encoding: FileSystem.EncodingType.UTF8
          });
          Alert.alert('Export complete', 'Guest list saved to the folder you selected.');
        }
      } else {
        const targetUri = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(targetUri, csvContent, {
          encoding: FileSystem.EncodingType.UTF8
        });
        Alert.alert(
          'Export complete',
          `Guest list saved to:\n${targetUri}\n\nYou can access it via the Files app.`
        );
      }
    } catch (err) {
      console.error('Guest list export failed', err);
      Alert.alert(
        'Export failed',
        'Something went wrong while exporting the guest list. Please try again.'
      );
    } finally {
      setExporting(false);
    }
  }, [rsvps]);

  const renderRsvp = ({ item }) => {
    const status = normalizeStatus(item?.status ?? item?.rsvp_status);
    const partySize = getPartySize(item);
    const notes = item?.message || item?.rsvp_notes || item?.notes;
    const guestNamesRaw = item?.guest_names?.toString() || '';
    const guestNamesList = guestNamesRaw
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const secondaryLine = guestNamesRaw.trim() || item?.email;
    const statusBusy = statusLoading[item.id];
    const editingLocked = !isCouple;
    const editingGuests = guestNamesEditor.id === item.id;
    const guestNamesBusy = guestNamesLoading[item.id];
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.guestName}>{item?.name || 'Unnamed Response'}</Text>
            {secondaryLine ? (
              <Text style={styles.guestEmail}>{secondaryLine}</Text>
            ) : null}
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${STATUS_META[status]?.color || theme.accent}20` }
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: STATUS_META[status]?.color || theme.accent }
              ]}
            />
            <Text style={styles.statusBadgeText}>
              {STATUS_META[status]?.label || 'Pending'}
            </Text>
          </View>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Party size</Text>
            <Text style={styles.metaValue}>{partySize}</Text>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLabel}>Status</Text>
            <View style={styles.statusButtons}>
              {['yes', 'pending', 'no'].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.statusButton,
                    status === option && {
                      backgroundColor: `${STATUS_META[option].color}30`,
                      borderColor: STATUS_META[option].color
                    },
                    (editingLocked || statusBusy) && styles.statusButtonDisabled
                  ]}
                  onPress={() => handleStatusChange(item.id, option)}
                  disabled={editingLocked || status === option || statusBusy}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      status === option && { color: STATUS_META[option].color }
                    ]}
                  >
                    {STATUS_META[option].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
        <View style={styles.guestNamesBlock}>
          <View style={styles.guestNamesHeader}>
            <Text style={styles.metaLabel}>Guest list</Text>
            {isCouple && !editingGuests ? (
              <TouchableOpacity
                style={styles.editGuestNamesButton}
                onPress={() => startGuestNamesEdit(item)}
              >
                <Feather name="edit-2" size={14} color={theme.textPrimary} />
                <Text style={styles.editGuestNamesText}>Edit</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {editingGuests ? (
            <>
              <TextInput
                style={styles.guestNamesInput}
                multiline
                placeholder="Enter guest names separated by commas"
                placeholderTextColor={theme.textMuted}
                value={guestNamesEditor.value}
                onChangeText={handleGuestNamesDraftChange}
                editable={!guestNamesBusy}
              />
              <View style={styles.guestNamesActions}>
                <TouchableOpacity
                  style={[
                    styles.guestNamesActionButton,
                    styles.guestNamesCancel,
                    guestNamesBusy && styles.buttonDisabled
                  ]}
                  onPress={cancelGuestNamesEdit}
                  disabled={guestNamesBusy}
                >
                  <Text style={styles.guestNamesActionText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.guestNamesActionButton,
                    styles.guestNamesSave,
                    (guestNamesBusy || !guestNamesEditor.value.trim()) && styles.buttonDisabled
                  ]}
                  onPress={handleGuestNamesSave}
                  disabled={guestNamesBusy || !guestNamesEditor.value.trim()}
                >
                  {guestNamesBusy ? (
                    <ActivityIndicator size="small" color={theme.background} />
                  ) : (
                    <Text
                      style={[
                        styles.guestNamesActionText,
                        styles.guestNamesSaveText
                      ]}
                    >
                      Save
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : guestNamesList.length ? (
            <View style={styles.guestNamesList}>
              {guestNamesList.map((guestName, index) => (
                <Text key={`${item.id}-guest-${index}`} style={styles.guestNameChip}>
                  {guestName}
                </Text>
              ))}
            </View>
          ) : (
            <Text style={styles.guestNamesEmpty}>No additional guests listed.</Text>
          )}
        </View>
        {notes ? (
          <View style={styles.notesBlock}>
            <Text style={styles.metaLabel}>Notes</Text>
            <Text style={styles.notesText}>{notes}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : null}
      <FlatList
        data={filteredRsvps}
        keyExtractor={(item, index) =>
          item?.id?.toString?.() ||
          item?.name ||
          item?.guest_names ||
          item?.email ||
          `rsvp-${index}`
        }
        ListHeaderComponent={
          <RsvpManagerHeader
            onClose={handleClose}
            lastUpdated={lastUpdated}
            isCouple={isCouple}
            onRefresh={handleRefresh}
            onExport={handleExportGuestList}
            exporting={exporting}
            stats={stats}
            searchValue={search}
            onSearchChange={setSearch}
            filter={filter}
            onFilterChange={setFilter}
            error={error}
          />
        }
        renderItem={renderRsvp}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No responses yet</Text>
              <Text style={styles.emptyText}>
                RSVPs will appear here as soon as responses start coming in.
              </Text>
            </View>
          )
        }
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

function RsvpManagerHeader({
  onClose,
  lastUpdated,
  isCouple,
  onRefresh,
  onExport,
  exporting,
  stats,
  searchValue,
  onSearchChange,
  filter,
  onFilterChange,
  error
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Feather name="chevron-left" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>RSVP Manager</Text>
          <Text style={styles.headerSubtitle}>
            Track RSVP responses, guest lists, and statuses in one place.
          </Text>
        </View>
      </View>
      {lastUpdated && (
        <Text style={styles.timestamp}>
          Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      )}
      {!isCouple && (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyTitle}>Read-only access</Text>
          <Text style={styles.readOnlyText}>
            RSVP responses are visible to everyone, but only the couple can update guest lists or statuses.
          </Text>
        </View>
      )}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Feather name="refresh-ccw" size={16} color={theme.textPrimary} />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
        {isCouple && (
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.buttonDisabled]}
            onPress={onExport}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color={theme.background} />
            ) : (
              <Feather name="download" size={16} color={theme.background} />
            )}
            <Text style={styles.exportText}>
              Export Guests
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Invites</Text>
          <Text style={styles.statValue}>{stats.total}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Attending</Text>
          <Text style={[styles.statValue, styles.acceptedValue]}>
            {stats.yes}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={[styles.statValue, styles.pendingValue]}>
            {stats.pending}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Declined</Text>
          <Text style={[styles.statValue, styles.declinedValue]}>
            {stats.no}
          </Text>
        </View>
        <View style={styles.statCardFull}>
          <Text style={styles.statLabel}>Expected Guests</Text>
          <Text style={styles.statValue}>{stats.guests}</Text>
        </View>
      </View>
      <TextInput
        style={styles.searchInput}
        placeholder="Search responses by name, guest list, or message"
        placeholderTextColor={theme.textMuted}
        value={searchValue}
        onChangeText={onSearchChange}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.filterRow}>
        {FILTERS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[
              styles.filterChip,
              filter === item.key && styles.filterChipActive
            ]}
            onPress={() => onFilterChange(item.key)}
          >
            <Text
              style={[
                styles.filterText,
                filter === item.key && styles.filterTextActive
              ]}
            >
              {item.label}
            </Text>
            {item.key !== 'all' && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {stats[item.key] || 0}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 15, 26, 0.6)',
    zIndex: 10
  },
  listContent: {
    paddingBottom: spacing.xl
  },
  pageHeader: {
    marginBottom: spacing.lg
  },
  readOnlyBanner: {
    backgroundColor: theme.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs
  },
  readOnlyTitle: {
    color: theme.textPrimary,
    fontWeight: '700',
    fontSize: 15
  },
  readOnlyText: {
    color: theme.textSecondary,
    fontSize: 13,
    lineHeight: 18
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerText: {
    flex: 1
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary
  },
  headerSubtitle: {
    color: theme.textSecondary,
    marginTop: 2
  },
  timestamp: {
    color: theme.textMuted,
    fontSize: 12,
    marginBottom: spacing.sm
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
    gap: spacing.sm,
    flexWrap: 'wrap'
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.border
  },
  refreshText: {
    color: theme.textPrimary,
    fontWeight: '600',
    fontSize: 14
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    backgroundColor: theme.accent
  },
  exportText: {
    color: theme.background,
    fontWeight: '600',
    fontSize: 14
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  statCard: {
    flexBasis: '48%',
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border
  },
  statCardFull: {
    flexBasis: '100%',
    backgroundColor: theme.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: theme.border
  },
  statLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4
  },
  statValue: {
    color: theme.textPrimary,
    fontSize: 24,
    fontWeight: '700'
  },
  acceptedValue: {
    color: theme.success
  },
  pendingValue: {
    color: theme.accentLight
  },
  declinedValue: {
    color: theme.error
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    color: theme.textPrimary,
    marginBottom: spacing.sm
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.border
  },
  filterChipActive: {
    borderColor: theme.accent,
    backgroundColor: 'rgba(212,175,55,0.1)'
  },
  filterText: {
    color: theme.textSecondary,
    fontSize: 13,
    fontWeight: '600'
  },
  filterTextActive: {
    color: theme.accent
  },
  filterBadge: {
    minWidth: 24,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center'
  },
  filterBadgeText: {
    color: theme.textPrimary,
    fontSize: 12,
    fontWeight: '600'
  },
  errorText: {
    color: theme.error,
    marginTop: spacing.sm,
    fontSize: 14
  },
  card: {
    backgroundColor: theme.card,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: spacing.md
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md
  },
  guestName: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  guestEmail: {
    color: theme.textSecondary,
    marginTop: 2
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusBadgeText: {
    color: theme.textPrimary,
    fontWeight: '600',
    fontSize: 12
  },
  metaRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap'
  },
  metaBlock: {
    flex: 1,
    minWidth: 160
  },
  metaLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs
  },
  metaValue: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  statusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  statusButton: {
    flexGrow: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center'
  },
  statusButtonDisabled: {
    opacity: 0.4
  },
  statusButtonText: {
    color: theme.textSecondary,
    fontWeight: '600',
    fontSize: 13
  },
  guestNamesBlock: {
    marginTop: spacing.md
  },
  guestNamesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs
  },
  editGuestNamesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  editGuestNamesText: {
    color: theme.accent,
    fontWeight: '600'
  },
  guestNamesInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: theme.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top'
  },
  guestNamesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  guestNameChip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    color: theme.textPrimary
  },
  guestNamesEmpty: {
    color: theme.textSecondary,
    fontStyle: 'italic'
  },
  guestNamesActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  guestNamesActionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: theme.border
  },
  guestNamesCancel: {
    backgroundColor: 'transparent'
  },
  guestNamesSave: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  guestNamesActionText: {
    color: theme.textPrimary,
    fontWeight: '600'
  },
  guestNamesSaveText: {
    color: theme.background
  },
  buttonDisabled: {
    opacity: 0.5
  },
  notesBlock: {
    marginTop: spacing.md
  },
  notesText: {
    color: theme.textPrimary,
    lineHeight: 20
  },
  emptyState: {
    marginTop: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm
  },
  emptyTitle: {
    color: theme.textPrimary,
    fontSize: 18,
    fontWeight: '700'
  },
  emptyText: {
    color: theme.textSecondary,
    textAlign: 'center',
    maxWidth: 240,
    lineHeight: 20
  },
});
