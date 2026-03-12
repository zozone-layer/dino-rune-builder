/* ============================================
   DINO MUTANT T-REX — RUNE BUILDER
   app.js — UI, simulation engine, saves
   ============================================ */

// ---- State ----
const state = {
  builds: {
    a: {}, // { runeName: level }
    b: {}
  }
};

// ---- Helpers ----
function getRune(name) { return RUNES_DATA[name]; }
function getLevelData(name, level) {
  const r = getRune(name);
  if (!r) return null;
  return r.levels.find(l => l.level === level) || r.levels[0];
}
function fmt(n, decimals = 0) {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
}
function pct(n) {
  if (n === null || n === undefined) return '—';
  return (n * 100).toFixed(1) + '%';
}

// ---- Simulation Engine ----
// Mirrors the spreadsheet logic exactly
function simulate(build, baseHP, baseAtk, baseCritPct, enemyHP, enemyAtk) {
  // 1. Collect all active rune level data
  const runeEntries = Object.entries(build).map(([name, level]) => ({
    name, level, data: getLevelData(name, level)
  })).filter(e => e.data);

  // 2. Static modifiers (Always frequency)
  let attackFlat = 0;
  let attackPct = 0;
  let hpFlat = 0;
  let hpPct = 0;
  let critPctBonus = 0;  // additive bonus to crit rate
  let critMultBonus = 0; // crit damage multiplier bonus

  for (const { data } of runeEntries) {
    const freq = data.freq || '';
    const isAlways = freq === 'Always' || freq === 'While all 5 alive';
    if (isAlways) {
      if (data.attack) attackFlat += data.attack;
      if (data.attack_pct) attackPct += data.attack_pct;
      if (data.hp) hpFlat += data.hp;
      if (data.hp_pct) hpPct += data.hp_pct;
      if (data.crit_pct) critPctBonus += data.crit_pct;
      if (data.crit) critMultBonus += data.crit;
    }
  }

  // 3. After-rune stats
  const finalHP = Math.round(baseHP * (1 + hpPct) + hpFlat);
  const finalAtk = Math.round(baseAtk * (1 + attackPct) + attackFlat);
  const finalCritPct = Math.min(1, baseCritPct / 100 + critPctBonus);
  const finalCritMult = 1 + critMultBonus; // e.g. 1.2 = 20% extra on crit

  // 4. Effective attack per hit (including crit)
  // Crit attack: base * (1 + crit_mult), normal attack: base
  // avg = base * (1 - critRate) + base * critMult * critRate
  const avgAtkPerHit = finalAtk * (1 - finalCritPct) + finalAtk * finalCritMult * finalCritPct;

  // 5. Proc-based bonuses — expressed as avg per attack
  let avgAttackBonus = 0;  // extra flat attack added per hit on average
  let avgHealPerHit = 0;   // HP healed per attack on average

  for (const { data } of runeEntries) {
    const freq = data.freq || '';
    const chance = data.chance || 1;

    if (freq === 'Every hit' || freq === 'Every attack') {
      // Heal HP %
      if (data.heal_hp_pct) {
        avgHealPerHit += data.heal_hp_pct * finalHP * chance;
      }
      // Heal from attack %
      if (data.heal_atk_pct) {
        avgHealPerHit += data.heal_atk_pct * avgAtkPerHit * chance;
      }
      // Damage reduction (flat, per hit) — contribute to effective tankiness but listed separately
      // One-time attack bonus proc
      if (data.one_time_atk) {
        avgAttackBonus += data.one_time_atk * avgAtkPerHit * chance;
      }
    }

    if (freq === 'Every third attack') {
      if (data.one_time_atk) {
        avgAttackBonus += data.one_time_atk * avgAtkPerHit * chance * (1 / 3);
      }
    }
  }

  // 6. Effective damage per attack (attack + procs)
  const totalDmgPerAtk = avgAtkPerHit + avgAttackBonus;

  // 7. Damage reduction per hit (static Hard Skinned / Dmg Resist)
  let flatDmgReduce = 0;
  for (const { data } of runeEntries) {
    const freq = data.freq || '';
    if ((freq === 'Every hit') && data.reduce_dmg) {
      const chance = data.chance || 1;
      flatDmgReduce += data.reduce_dmg * chance;
    }
  }

  // 8. Effective incoming damage per enemy attack
  const effectiveEnemyAtk = Math.max(0, enemyAtk - flatDmgReduce);

  // 9. Attacks needed to kill enemy (enemy HP / our total dmg per atk)
  const attacksToKillEnemy = totalDmgPerAtk > 0
    ? Math.ceil(enemyHP / totalDmgPerAtk)
    : Infinity;

  // 10. Hits to be killed (our HP / enemy atk after reduction)
  const hitsToSurvive = effectiveEnemyAtk > 0
    ? Math.ceil(finalHP / effectiveEnemyAtk)
    : Infinity;

  // 11. Total healed during combat (our attacks * avgHealPerHit)
  const totalHealed = Math.round(attacksToKillEnemy * avgHealPerHit);

  // 12. Active rune count (for "X" limit display)
  const activeCount = Object.keys(build).length;

  return {
    finalHP,
    finalAtk,
    finalCritPct,
    finalCritMult,
    avgAtkPerHit: Math.round(avgAtkPerHit),
    avgAttackBonus: Math.round(avgAttackBonus),
    avgHealPerHit: Math.round(avgHealPerHit),
    totalDmgPerAtk: Math.round(totalDmgPerAtk),
    flatDmgReduce: Math.round(flatDmgReduce),
    effectiveEnemyAtk: Math.round(effectiveEnemyAtk),
    attacksToKillEnemy: isFinite(attacksToKillEnemy) ? attacksToKillEnemy : '∞',
    hitsToSurvive: isFinite(hitsToSurvive) ? hitsToSurvive : '∞',
    totalHealed,
    activeCount,
    attackPct,
    hpPct,
  };
}

// ---- Results Renderer ----
function getBaseStats() {
  return {
    hp: parseFloat(document.getElementById('base-hp').value) || 3110,
    atk: parseFloat(document.getElementById('base-atk').value) || 330,
    crit: parseFloat(document.getElementById('base-crit').value) || 0,
    enemyHp: parseFloat(document.getElementById('enemy-hp').value) || 15000,
    enemyAtk: parseFloat(document.getElementById('enemy-atk').value) || 800,
  };
}

function renderResults(panelId) {
  const build = state.builds[panelId];
  const el = document.getElementById('results-' + panelId);
  const s = getBaseStats();
  const sim = simulate(build, s.hp, s.atk, s.crit, s.enemyHp, s.enemyAtk);

  if (Object.keys(build).length === 0) {
    el.innerHTML = '<div class="results-empty">Select runes above to see stats</div>';
    return;
  }

  const hpChange = sim.finalHP - s.hp;
  const atkChange = sim.finalAtk - s.atk;

  el.innerHTML = `
    <div class="results-section-title">Fighter stats after runes</div>
    <div class="stat-row">
      <span class="stat-label">HP</span>
      <span class="stat-value highlight">${fmt(sim.finalHP)}
        <span class="stat-change ${hpChange >= 0 ? 'up' : 'down'}">${hpChange >= 0 ? '+' : ''}${fmt(hpChange)}</span>
      </span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Attack</span>
      <span class="stat-value highlight">${fmt(sim.finalAtk)}
        <span class="stat-change ${atkChange >= 0 ? 'up' : 'down'}">${atkChange >= 0 ? '+' : ''}${fmt(atkChange)}</span>
      </span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Crit rate</span>
      <span class="stat-value">${pct(sim.finalCritPct)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Crit damage</span>
      <span class="stat-value">${pct(sim.finalCritMult - 1)} bonus</span>
    </div>

    <div class="results-section-title">Offensive simulation</div>
    <div class="stat-row">
      <span class="stat-label">Avg damage / attack</span>
      <span class="stat-value">${fmt(sim.avgAtkPerHit)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Avg proc bonus / attack</span>
      <span class="stat-value ${sim.avgAttackBonus > 0 ? 'pos' : ''}">${fmt(sim.avgAttackBonus)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Total avg dmg / attack</span>
      <span class="stat-value highlight">${fmt(sim.totalDmgPerAtk)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Attacks to kill enemy</span>
      <span class="stat-value">${sim.attacksToKillEnemy}</span>
    </div>

    <div class="results-section-title">Defensive simulation</div>
    <div class="stat-row">
      <span class="stat-label">Flat dmg reduction / hit</span>
      <span class="stat-value ${sim.flatDmgReduce > 0 ? 'pos' : ''}">${fmt(sim.flatDmgReduce)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Effective enemy atk / hit</span>
      <span class="stat-value">${fmt(sim.effectiveEnemyAtk)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Hits to survive</span>
      <span class="stat-value">${sim.hitsToSurvive}</span>
    </div>

    <div class="results-section-title">Healing</div>
    <div class="stat-row">
      <span class="stat-label">Avg heal / attack</span>
      <span class="stat-value ${sim.avgHealPerHit > 0 ? 'pos' : ''}">${fmt(sim.avgHealPerHit)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">Total healed (full fight)</span>
      <span class="stat-value ${sim.totalHealed > 0 ? 'pos' : ''}">${fmt(sim.totalHealed)}</span>
    </div>
  `;
}

function renderAllResults() {
  renderResults('a');
  renderResults('b');
}

// ---- Rune Grid Renderer ----
function buildRuneGrid(panelId) {
  const grid = document.getElementById('grid-' + panelId);
  grid.innerHTML = '';

  Object.entries(RUNES_DATA).forEach(([name, rune]) => {
    const isActive = !!state.builds[panelId][name];
    const currentLevel = state.builds[panelId][name] || 1;

    const slot = document.createElement('div');
    slot.className = `rune-slot tier-${rune.tier}${isActive ? ' active' : ''}`;
    slot.dataset.rune = name;
    slot.dataset.panel = panelId;

    // Level badge
    const badge = document.createElement('div');
    badge.className = 'rune-level-badge';
    badge.textContent = 'Lv' + currentLevel;

    // Icon
    const img = document.createElement('img');
    img.className = 'rune-icon';
    img.src = `icons/${rune.icon}.png`;
    img.alt = name;
    img.onerror = () => { img.src = `icons/heal.png`; };

    // Name
    const nameEl = document.createElement('div');
    nameEl.className = 'rune-slot-name';
    nameEl.textContent = name;

    // Level selector (visible when active)
    const sel = document.createElement('select');
    sel.className = 'rune-level-select';
    for (let lv = 1; lv <= 31; lv++) {
      const opt = document.createElement('option');
      opt.value = lv;
      opt.textContent = 'Lv ' + lv;
      if (lv === currentLevel) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', (e) => {
      e.stopPropagation();
      const lv = parseInt(e.target.value);
      state.builds[panelId][name] = lv;
      badge.textContent = 'Lv' + lv;
      renderResults(panelId);
    });

    // Toggle on click (but not level selector)
    slot.addEventListener('click', (e) => {
      if (e.target === sel || e.target.tagName === 'OPTION') return;
      if (isActive || state.builds[panelId][name]) {
        // Deactivate
        delete state.builds[panelId][name];
        slot.classList.remove('active');
        sel.style.display = 'none';
        badge.style.opacity = '0';
        slot.querySelector('.rune-slot-name').style.color = '';
      } else {
        // Activate
        state.builds[panelId][name] = parseInt(sel.value);
        slot.classList.add('active');
      }
      renderResults(panelId);
    });

    // Right-click = open modal detail
    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openRuneModal(name);
    });

    slot.appendChild(badge);
    slot.appendChild(img);
    slot.appendChild(nameEl);
    slot.appendChild(sel);
    grid.appendChild(slot);
  });
}

// ---- Rune Reference Tab ----
function buildReferenceGrid(tierFilter) {
  const grid = document.getElementById('reference-grid');
  grid.innerHTML = '';

  const runes = Object.values(RUNES_DATA).filter(r => {
    return tierFilter === 'all' || r.tier === tierFilter;
  });

  runes.forEach(rune => {
    const lv1 = rune.levels[0];
    const lv31 = rune.levels[30];

    const card = document.createElement('div');
    card.className = `ref-card tier-${rune.tier}`;
    card.addEventListener('click', () => openRuneModal(rune.name));

    // Build a short stat summary
    const statLines = [];
    if (lv1.attack) statLines.push(`+${lv1.attack}→${lv31.attack} Attack`);
    if (lv1.attack_pct) statLines.push(`${pct(lv1.attack_pct)}→${pct(lv31.attack_pct)} Attack`);
    if (lv1.hp) statLines.push(`+${lv1.hp}→${lv31.hp} HP`);
    if (lv1.hp_pct) statLines.push(`${pct(lv1.hp_pct)}→${pct(lv31.hp_pct)} HP`);
    if (lv1.crit_pct) statLines.push(`+${pct(lv1.crit_pct)}→${pct(lv31.crit_pct)} Crit rate`);
    if (lv1.crit) statLines.push(`+${pct(lv1.crit)}→${pct(lv31.crit)} Crit dmg`);
    if (lv1.heal_hp_pct) statLines.push(`${pct(lv1.heal_hp_pct)}→${pct(lv31.heal_hp_pct)} HP heal`);
    if (lv1.heal_atk_pct) statLines.push(`${pct(lv1.heal_atk_pct)}→${pct(lv31.heal_atk_pct)} Atk drain`);
    if (lv1.reduce_dmg) statLines.push(`${lv1.reduce_dmg}→${lv31.reduce_dmg} dmg reduction`);
    if (lv1.one_time_atk) statLines.push(`${pct(lv1.one_time_atk)}→${pct(lv31.one_time_atk)} bonus atk`);

    card.innerHTML = `
      <div class="ref-card-header">
        <img class="ref-icon" src="icons/${rune.icon}.png" alt="${rune.name}" onerror="this.src='icons/heal.png'">
        <div class="ref-card-titles">
          <div class="ref-card-name">${rune.name}</div>
          <span class="ref-tier-badge">${rune.tier_label}</span>
        </div>
      </div>
      <div class="ref-freq">${lv1.freq || ''}${lv1.chance ? ' · ' + pct(lv1.chance) + ' chance' : ''}</div>
      <div class="ref-stat-preview">${statLines.slice(0, 3).map(s => `<strong>${s}</strong>`).join('<br>')}</div>
    `;
    grid.appendChild(card);
  });
}

// ---- Modal ----
function openRuneModal(name) {
  const rune = getRune(name);
  if (!rune) return;

  // Determine non-null stat columns
  const statCols = [
    { key: 'attack',       label: 'Attack' },
    { key: 'attack_pct',   label: 'Atk %',    format: pct },
    { key: 'hp',           label: 'HP' },
    { key: 'hp_pct',       label: 'HP %',     format: pct },
    { key: 'crit',         label: 'Crit dmg', format: pct },
    { key: 'crit_pct',     label: 'Crit rate',format: pct },
    { key: 'heal_hp_pct',  label: 'Heal HP%', format: pct },
    { key: 'heal_atk_pct', label: 'Drain %',  format: pct },
    { key: 'reduce_dmg',   label: 'Dmg Red.' },
    { key: 'one_time_atk', label: 'Bonus Atk',format: pct },
    { key: 'turns',        label: 'Turns' },
    { key: 'chance',       label: 'Chance',   format: pct },
  ].filter(col => rune.levels.some(l => l[col.key] !== null && l[col.key] !== undefined));

  const headerRow = `<tr><th>Lv</th>${statCols.map(c => `<th>${c.label}</th>`).join('')}</tr>`;
  const dataRows = rune.levels.map(l => {
    const cells = statCols.map(col => {
      const v = l[col.key];
      if (v === null || v === undefined) return '<td>—</td>';
      const formatted = col.format ? col.format(v) : fmt(v);
      return `<td>${formatted}</td>`;
    }).join('');
    return `<tr><td>${l.level}</td>${cells}</tr>`;
  }).join('');

  const lv1 = rune.levels[0];
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-rune-header">
      <img class="modal-icon" src="icons/${rune.icon}.png" alt="${name}" onerror="this.src='icons/heal.png'">
      <div>
        <div class="modal-rune-name">${name}</div>
        <span class="ref-tier-badge tier-${rune.tier}" style="display:inline-block;margin-top:4px">${rune.tier_label}</span>
        <div class="ref-freq" style="margin-top:6px">${lv1.freq || ''}${lv1.chance ? ' · ' + pct(lv1.chance) + '+ chance' : ''}</div>
      </div>
    </div>
    <table class="level-table">
      <thead>${headerRow}</thead>
      <tbody>${dataRows}</tbody>
    </table>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

// ---- Saved Builds ----
const STORAGE_KEY = 'dino-rune-builds-v1';

function loadSavedBuilds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch { return {}; }
}

function persistBuilds(saved) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function saveBuild(panelId) {
  const name = document.getElementById('build-name').value.trim();
  if (!name) { alert('Enter a build name first.'); return; }
  const saved = loadSavedBuilds();
  saved[name] = { runes: { ...state.builds[panelId] }, savedAt: Date.now() };
  persistBuilds(saved);
  renderSavedList();
  document.getElementById('build-name').value = '';
}

function loadBuildIntoPanel(name, panelId) {
  const saved = loadSavedBuilds();
  if (!saved[name]) return;
  state.builds[panelId] = { ...saved[name].runes };
  buildRuneGrid(panelId);
  renderResults(panelId);
}

function deleteSaved(name) {
  const saved = loadSavedBuilds();
  delete saved[name];
  persistBuilds(saved);
  renderSavedList();
}

function renderSavedList() {
  const saved = loadSavedBuilds();
  const list = document.getElementById('saved-list');
  const keys = Object.keys(saved);

  if (keys.length === 0) {
    list.innerHTML = '<span style="font-size:11px;color:var(--text-dim)">No saved builds yet</span>';
    return;
  }

  list.innerHTML = keys.map(name => `
    <div class="saved-item">
      <span class="saved-item-name" title="Click A or B to load">${name}</span>
      <button class="saved-load-a" onclick="loadBuildIntoPanel('${name.replace(/'/g,"\\'")}','a')">A</button>
      <button class="saved-load-b" onclick="loadBuildIntoPanel('${name.replace(/'/g,"\\'")}','b')">B</button>
      <button class="saved-delete" onclick="deleteSaved('${name.replace(/'/g,"\\'")}')">✕</button>
    </div>
  `).join('');
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  // Build grids
  buildRuneGrid('a');
  buildRuneGrid('b');
  renderAllResults();

  // Build reference grid
  buildReferenceGrid('all');

  // Load saved builds
  renderSavedList();

  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // Reference filters
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      buildReferenceGrid(btn.dataset.tier);
    });
  });

  // Clear buttons
  document.querySelectorAll('.btn-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      state.builds[panel] = {};
      buildRuneGrid(panel);
      renderResults(panel);
    });
  });

  // Save buttons
  document.getElementById('btn-save-a').addEventListener('click', () => saveBuild('a'));
  document.getElementById('btn-save-b').addEventListener('click', () => saveBuild('b'));

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Fighter stat changes trigger recalculation
  ['base-hp', 'base-atk', 'base-crit', 'enemy-hp', 'enemy-atk'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderAllResults);
  });
});
