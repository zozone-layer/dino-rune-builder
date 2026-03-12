# Dino Mutant T-Rex — Rune Builder

A web app to compare rune builds for Dino Mutant T-Rex by MondayOff.

## Setup

### 1. Add your rune icons
Place your 25 rune icon `.png` files in the `icons/` folder with these exact filenames:

| Rune | Filename |
|---|---|
| Heal | `heal.png` |
| Inc Attack I | `inc_attack_i.png` |
| Inc HP I | `inc_hp_i.png` |
| Sacrifice | `sacrifice.png` |
| Final Gift | `final_gift.png` |
| Triple Impact | `triple_impact.png` |
| Hard Skinned I | `hard_skinned_i.png` |
| Dmg Resist I | `dmg_resist_i.png` |
| Inc Attack II | `inc_attack_ii.png` |
| Inc HP II | `inc_hp_ii.png` |
| Unified Strike | `unified_strike.png` |
| Hard Skinned II | `hard_skinned_ii.png` |
| Dmg Resist II | `dmg_resist_ii.png` |
| Critical Rate | `critical_rate.png` |
| Critical Attack | `critical_attack.png` |
| Inc Attack III | `inc_attack_iii.png` |
| Inc HP III | `inc_hp_iii.png` |
| RTD | `rtd.png` |
| Compact Power | `compact_power.png` |
| Mammoth | `mammoth.png` |
| Drain Life | `drain_life.png` |
| Smite | `smite.png` |
| Barrier | `barrier.png` |
| Meteor | `meteor.png` |
| Lightning | `lightning.png` |

### 2. Host on GitHub Pages (free)

1. Create a free account at [github.com](https://github.com)
2. Click **New repository**, name it `dino-rune-builder`, set it to **Public**
3. Upload all files (keep the folder structure: `icons/` folder, `index.html`, `style.css`, `app.js`, `runes.js`)
4. Go to **Settings → Pages → Source**, select `main` branch, click **Save**
5. Your app will be live at `https://YOUR-USERNAME.github.io/dino-rune-builder`

## Features

- **Build & Compare** — Toggle runes on/off for two builds side by side, set rune level (1–31), adjust fighter base stats and enemy stats
- **Simulation output** — After-rune HP & Attack, avg damage per attack, attacks to kill enemy, hits to survive, total healing
- **Save builds** — Name and save builds to your browser (no account needed)
- **Rune Reference** — Browse all 25 runes filtered by tier, click any for full level table

## Files

```
index.html   — page structure
style.css    — dark fantasy theme
app.js       — simulation engine + UI logic
runes.js     — all rune data (25 runes × 31 levels each)
icons/       — your rune PNG files go here
```
