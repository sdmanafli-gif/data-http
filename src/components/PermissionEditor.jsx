import { useMemo, useState } from 'react'
import { APP_MODULES, defaultTabPerm, fullPermissions, normalizePermissions } from '../config/permissions'
import '../styles/shared.css'

/**
 * Admin UI: pick one module tab, configure everything for it in one place
 * (visibility/CRUD → cəmlər → columns → dropdown filters).
 */
export default function PermissionEditor({ value, onChange }) {
  const perms = normalizePermissions(value)
  const visibleModules = useMemo(
    () => APP_MODULES.filter((m) => (perms.tabs[m.id] || defaultTabPerm()).visible !== false),
    [perms.tabs]
  )
  const [activeId, setActiveId] = useState(() => APP_MODULES[0]?.id || 'depo')
  const active = APP_MODULES.find((m) => m.id === activeId) || APP_MODULES[0]
  const tab = perms.tabs[active.id] || defaultTabPerm()

  function patch(next) {
    onChange(normalizePermissions(next))
  }

  function setTab(moduleId, patchTab) {
    patch({
      ...perms,
      tabs: {
        ...perms.tabs,
        [moduleId]: { ...defaultTabPerm(), ...perms.tabs[moduleId], ...patchTab },
      },
    })
  }

  function setAllTabs(visible) {
    const tabs = {}
    for (const mod of APP_MODULES) {
      tabs[mod.id] = {
        ...defaultTabPerm(),
        ...perms.tabs[mod.id],
        visible,
        canView: visible,
        canCreate: visible ? perms.tabs[mod.id]?.canCreate !== false : false,
        canEdit: visible ? perms.tabs[mod.id]?.canEdit !== false : false,
        canDelete: visible ? perms.tabs[mod.id]?.canDelete !== false : false,
      }
    }
    patch({ ...perms, tabs })
  }

  function setColumns(moduleId, keysOrNull) {
    patch({
      ...perms,
      columns: { ...perms.columns, [moduleId]: keysOrNull },
    })
  }

  function toggleColumn(moduleId, key, allKeys) {
    const current = perms.columns[moduleId]
    const selected = current == null ? [...allKeys] : [...current]
    const idx = selected.indexOf(key)
    if (idx >= 0) selected.splice(idx, 1)
    else selected.push(key)
    if (selected.length === allKeys.length) setColumns(moduleId, null)
    else setColumns(moduleId, selected)
  }

  function setScope(patchScope) {
    patch({
      ...perms,
      dataScope: { ...perms.dataScope, ...patchScope },
    })
  }

  function setValueFilter(moduleId, columnKey, valuesOrNull) {
    patch({
      ...perms,
      valueFilters: {
        ...perms.valueFilters,
        [moduleId]: {
          ...(perms.valueFilters[moduleId] || {}),
          [columnKey]: valuesOrNull,
        },
      },
    })
  }

  function toggleValueFilter(moduleId, columnKey, optionValue, allValues) {
    const current = perms.valueFilters[moduleId]?.[columnKey]
    const selected = current == null ? [...allValues] : [...current]
    const idx = selected.indexOf(optionValue)
    if (idx >= 0) selected.splice(idx, 1)
    else selected.push(optionValue)
    if (selected.length === allValues.length) setValueFilter(moduleId, columnKey, null)
    else setValueFilter(moduleId, columnKey, selected)
  }

  function setSummaryCards(moduleId, keysOrNull) {
    patch({
      ...perms,
      summaryCards: { ...perms.summaryCards, [moduleId]: keysOrNull },
    })
  }

  function toggleSummaryCard(moduleId, key, allKeys) {
    const current = perms.summaryCards[moduleId]
    const selected = current == null ? [...allKeys] : [...current]
    const idx = selected.indexOf(key)
    if (idx >= 0) selected.splice(idx, 1)
    else selected.push(key)
    if (selected.length === allKeys.length) setSummaryCards(moduleId, null)
    else setSummaryCards(moduleId, selected)
  }

  const summaryCards = active.summaryCards || []
  const summarySelected = perms.summaryCards[active.id]
  const summaryAll = summarySelected == null
  const summarySet = new Set(summaryAll ? summaryCards.map((c) => c.key) : summarySelected || [])
  const summaryAllKeys = summaryCards.map((c) => c.key)

  const filterByKey = Object.fromEntries((active.filterFields || []).map((f) => [f.key, f]))
  const columnKeys = new Set(active.columns.map((c) => c.key))
  const columnRows = [
    ...active.columns.map((c) => ({
      key: c.key,
      label: c.label,
      filter: filterByKey[c.key] || null,
      filterOnly: false,
    })),
    ...(active.filterFields || [])
      .filter((f) => !columnKeys.has(f.key))
      .map((f) => ({ key: f.key, label: f.label, filter: f, filterOnly: true })),
  ]
  const visibilityKeys = active.columns.map((c) => c.key)
  const colSelected = perms.columns[active.id]
  const colsAllVisible = colSelected == null
  const colSet = new Set(colsAllVisible ? visibilityKeys : colSelected || [])
  const moduleFilters = perms.valueFilters[active.id] || {}
  const dropdownRows = columnRows.filter((r) => r.filter)

  return (
    <div className="permission-editor">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => patch(fullPermissions())}>
          Hamısına icazə
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAllTabs(true)}>
          Bütün tabları aç
        </button>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setAllTabs(false)}>
          Bütün tabları bağla
        </button>
      </div>

      {/* Global: sira_no */}
      <section className="card" style={{ marginBottom: 16, padding: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Ümumi — məlumat limiti (sira_no)</h3>
        <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: 13 }}>
          Bütün tablar üçün müştəri sıra nömrəsi aralığı.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input
              type="radio"
              name="data-scope-mode"
              checked={perms.dataScope.mode === 'all'}
              onChange={() => setScope({ mode: 'all' })}
            />
            Hamısı
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
            <input
              type="radio"
              name="data-scope-mode"
              checked={perms.dataScope.mode === 'sira_no_range'}
              onChange={() => setScope({ mode: 'sira_no_range' })}
            />
            Sıra aralığı
          </label>
          {perms.dataScope.mode === 'sira_no_range' && (
            <>
              <div className="form-group" style={{ marginBottom: 0, width: 120 }}>
                <label>Başlanğıc</label>
                <input
                  type="number"
                  value={perms.dataScope.siraNoFrom ?? ''}
                  onChange={(e) =>
                    setScope({ siraNoFrom: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, width: 120 }}>
                <label>Son</label>
                <input
                  type="number"
                  value={perms.dataScope.siraNoTo ?? ''}
                  onChange={(e) =>
                    setScope({ siraNoTo: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </div>
            </>
          )}
        </div>
      </section>

      {/* Module picker */}
      <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>Modul seçin</h3>
      <p style={{ marginTop: 0, marginBottom: 12, color: 'var(--color-text-muted)', fontSize: 13 }}>
        Bir tab seçin — Cəmlər, sütunlar və dropdown filtrləri eyni yerdə tənzimlənir.
      </p>
      <div
        role="tablist"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid var(--color-border, #ddd)',
        }}
      >
        {APP_MODULES.map((mod) => {
          const t = perms.tabs[mod.id] || defaultTabPerm()
          const isActive = mod.id === active.id
          return (
            <button
              key={mod.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`btn btn--sm ${isActive ? 'btn--primary' : 'btn--secondary'}`}
              onClick={() => setActiveId(mod.id)}
              style={{ opacity: t.visible === false ? 0.55 : 1 }}
              title={t.visible === false ? 'Tab bağlıdır' : mod.label}
            >
              {mod.label}
              {t.visible === false ? ' · bağlı' : ''}
            </button>
          )
        })}
      </div>

      {/* Single module workspace */}
      <section
        className="card"
        style={{ padding: 16, border: '1px solid var(--color-border, #ddd)' }}
        aria-labelledby={`perm-mod-${active.id}`}
      >
        <h2 id={`perm-mod-${active.id}`} style={{ margin: '0 0 4px', fontSize: 18 }}>
          {active.label}
        </h2>
        <p style={{ margin: '0 0 20px', color: 'var(--color-text-muted)', fontSize: 13 }}>
          Aşağıdakı addımları bu modul üçün tamamlayın.
        </p>

        {/* 1. Tab access */}
        <div style={stepBox}>
          <div style={stepTitle}>1. Tab girişi</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <label style={checkLabel}>
              <input
                type="checkbox"
                checked={tab.visible !== false}
                onChange={(e) =>
                  setTab(active.id, {
                    visible: e.target.checked,
                    canView: e.target.checked,
                  })
                }
              />
              Tabı görür
            </label>
            <label style={{ ...checkLabel, opacity: tab.visible ? 1 : 0.4 }}>
              <input
                type="checkbox"
                checked={Boolean(tab.canCreate)}
                disabled={!tab.visible}
                onChange={(e) => setTab(active.id, { canCreate: e.target.checked })}
              />
              Əlavə edə bilər
            </label>
            <label style={{ ...checkLabel, opacity: tab.visible ? 1 : 0.4 }}>
              <input
                type="checkbox"
                checked={Boolean(tab.canEdit)}
                disabled={!tab.visible}
                onChange={(e) => setTab(active.id, { canEdit: e.target.checked })}
              />
              Redaktə edə bilər
            </label>
            <label style={{ ...checkLabel, opacity: tab.visible ? 1 : 0.4 }}>
              <input
                type="checkbox"
                checked={Boolean(tab.canDelete)}
                disabled={!tab.visible}
                onChange={(e) => setTab(active.id, { canDelete: e.target.checked })}
              />
              Silə bilər
            </label>
          </div>
          {!tab.visible && (
            <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
              Tab bağlıdır — digər ayarlar saxlanılır, amma istifadəçi bu menyunu görməyəcək.
            </p>
          )}
        </div>

        {/* 2. Cəmlər */}
        <div style={{ ...stepBox, opacity: tab.visible ? 1 : 0.45 }}>
          <div style={stepTitle}>2. Cəmlər kartları</div>
          {summaryCards.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Bu modulda cəm kartı yoxdur.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={!tab.visible}
                  onClick={() => setSummaryCards(active.id, null)}
                >
                  Hamısı
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={!tab.visible}
                  onClick={() => setSummaryCards(active.id, [])}
                >
                  Heç biri (cəmlər yox)
                </button>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                  {summaryAll
                    ? 'bütün kartlar'
                    : summarySelected.length === 0
                      ? 'cəmlər gizli'
                      : `${summarySelected.length} kart`}
                </span>
              </div>
              <div style={chipGrid}>
                {summaryCards.map((card) => (
                  <label key={card.key} style={chipLabel}>
                    <input
                      type="checkbox"
                      disabled={!tab.visible}
                      checked={summarySet.has(card.key)}
                      onChange={() => toggleSummaryCard(active.id, card.key, summaryAllKeys)}
                    />
                    {card.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 3. Columns */}
        <div style={{ ...stepBox, opacity: tab.visible ? 1 : 0.45 }}>
          <div style={stepTitle}>3. Sütunlar (görünüş)</div>
          {visibilityKeys.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Bu modulda idarə olunan sütun yoxdur.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={!tab.visible}
                  onClick={() => setColumns(active.id, null)}
                >
                  Bütün sütunları göstər
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  disabled={!tab.visible}
                  onClick={() => setColumns(active.id, [])}
                >
                  Bütün sütunları gizlət
                </button>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                  {colsAllVisible ? 'hamısı görünür' : `${colSelected.length} / ${visibilityKeys.length}`}
                </span>
              </div>
              <div style={chipGrid}>
                {active.columns.map((col) => (
                  <label key={col.key} style={chipLabel}>
                    <input
                      type="checkbox"
                      disabled={!tab.visible}
                      checked={colSet.has(col.key)}
                      onChange={() => toggleColumn(active.id, col.key, visibilityKeys)}
                    />
                    {col.label}
                    {filterByKey[col.key] ? (
                      <span style={dropdownBadge}>dropdown</span>
                    ) : null}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 4. Dropdown filters */}
        <div style={{ ...stepBox, marginBottom: 0, opacity: tab.visible ? 1 : 0.45 }}>
          <div style={stepTitle}>4. Dropdown filtrləri</div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Yalnız seçim siyahısı olan sütunlar. Hamısı seçilidirsə məhdudiyyət yoxdur; əks halda istifadəçi
            yalnız seçilmiş dəyərləri görür.
          </p>
          {dropdownRows.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
              Bu modulda dropdown sütun yoxdur.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dropdownRows.map((row) => {
                const field = row.filter
                const allValues = field.options.map((o) => o.value)
                const selected = moduleFilters[field.key]
                const isAll = selected == null
                const selectedSet = new Set(isAll ? allValues : selected || [])
                return (
                  <div
                    key={row.key}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--color-border, #ddd)',
                      background: 'var(--color-bg, #fff)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 8,
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <strong style={{ fontSize: 14 }}>{row.label}</strong>
                      {row.filterOnly && (
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          (yalnız filtr)
                        </span>
                      )}
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={!tab.visible}
                        onClick={() => setValueFilter(active.id, field.key, null)}
                      >
                        Hamısı
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        disabled={!tab.visible}
                        onClick={() => setValueFilter(active.id, field.key, [])}
                      >
                        Heç biri
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {isAll
                          ? 'məhdudiyyət yoxdur'
                          : selected.length === 0
                            ? 'heç bir dəyər'
                            : `${selected.length} dəyər`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {field.options.map((opt) => (
                        <label key={opt.value} style={checkLabel}>
                          <input
                            type="checkbox"
                            disabled={!tab.visible}
                            checked={selectedSet.has(opt.value)}
                            onChange={() =>
                              toggleValueFilter(active.id, field.key, opt.value, allValues)
                            }
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {visibleModules.length === 0 && (
        <p style={{ marginTop: 12, color: 'var(--color-accent)', fontSize: 13 }}>
          Diqqət: heç bir tab açıq deyil — istifadəçi menyuda heç nə görməyəcək.
        </p>
      )}
    </div>
  )
}

const stepBox = {
  marginBottom: 20,
  padding: 14,
  borderRadius: 10,
  background: 'var(--color-surface, #f6f7f9)',
  border: '1px solid var(--color-border, #e5e7eb)',
}

const stepTitle = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 10,
}

const checkLabel = {
  fontSize: 13,
  display: 'inline-flex',
  gap: 6,
  alignItems: 'center',
}

const chipGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 8,
}

const chipLabel = {
  fontSize: 13,
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  padding: '8px 10px',
  borderRadius: 8,
  background: 'var(--color-bg, #fff)',
  border: '1px solid var(--color-border, #e5e7eb)',
}

const dropdownBadge = {
  marginLeft: 'auto',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--color-text-muted)',
  background: 'var(--color-border, #e5e7eb)',
  padding: '1px 6px',
  borderRadius: 4,
}
