#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# PARALLAX Directory Cleanup Script
# Moves legacy/demo files to _archive folder
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Navigate to trading folder
cd "$(dirname "$0")"

echo "🧹 PARALLAX Directory Cleanup"
echo "════════════════════════════════════════════════════════"

# Create archive structure
mkdir -p _archive/html-legacy
mkdir -p _archive/html-demos
mkdir -p _archive/docs-legacy
mkdir -p _archive/docs-dev-logs

echo ""
echo "📁 Creating archive folders..."

# ═══════════════════════════════════════════════════════════════════════════
# ARCHIVE: Legacy HTML pages
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "📦 Archiving legacy HTML files..."

# derivatives.html - Old full-page variant, superseded by index.html
if [ -f "derivatives.html" ]; then
    mv derivatives.html _archive/html-legacy/
    echo "   ✓ derivatives.html → _archive/html-legacy/"
fi

# ship-select.html - Old ship selection page
if [ -f "ship-select.html" ]; then
    mv ship-select.html _archive/html-legacy/
    echo "   ✓ ship-select.html → _archive/html-legacy/"
fi

# index-legacy.html - Backup of old index
if [ -f "index-legacy.html" ]; then
    mv index-legacy.html _archive/html-legacy/
    echo "   ✓ index-legacy.html → _archive/html-legacy/"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ARCHIVE: Development demo/tool HTML pages
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "🔧 Archiving development demo files..."

# ship-behavior-demo.html - Dev demo for testing animations
if [ -f "ship-behavior-demo.html" ]; then
    mv ship-behavior-demo.html _archive/html-demos/
    echo "   ✓ ship-behavior-demo.html → _archive/html-demos/"
fi

# sprite-upgrades.html - Dev tool for sprite testing
if [ -f "sprite-upgrades.html" ]; then
    mv sprite-upgrades.html _archive/html-demos/
    echo "   ✓ sprite-upgrades.html → _archive/html-demos/"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ARCHIVE: Legacy/superseded documentation
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "📄 Archiving legacy documentation..."

# Old project name READMEs (HASLUN-BOT name is deprecated)
if [ -f "HASLUN-BOT-README.md" ]; then
    mv HASLUN-BOT-README.md _archive/docs-legacy/
    echo "   ✓ HASLUN-BOT-README.md → _archive/docs-legacy/"
fi

if [ -f "HASLUN-BOT-Structure-Analysis.md" ]; then
    mv HASLUN-BOT-Structure-Analysis.md _archive/docs-legacy/
    echo "   ✓ HASLUN-BOT-Structure-Analysis.md → _archive/docs-legacy/"
fi

# ═══════════════════════════════════════════════════════════════════════════
# ARCHIVE: Development logs and reports
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "📋 Archiving development logs..."

if [ -f "MODULARIZATION-LOG.md" ]; then
    mv MODULARIZATION-LOG.md _archive/docs-dev-logs/
    echo "   ✓ MODULARIZATION-LOG.md → _archive/docs-dev-logs/"
fi

if [ -f "OPTIMIZATION-REPORT.md" ]; then
    mv OPTIMIZATION-REPORT.md _archive/docs-dev-logs/
    echo "   ✓ OPTIMIZATION-REPORT.md → _archive/docs-dev-logs/"
fi

if [ -f "FLEET-ANIMATION-INTEGRATION.md" ]; then
    mv FLEET-ANIMATION-INTEGRATION.md _archive/docs-dev-logs/
    echo "   ✓ FLEET-ANIMATION-INTEGRATION.md → _archive/docs-dev-logs/"
fi

# ═══════════════════════════════════════════════════════════════════════════
# CONSOLIDATE: READMEs - Keep one, archive duplicate
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "📝 Consolidating README files..."

# Keep PARALLAX-README.md as the main README, archive SPACE-CAPITAL variant
if [ -f "SPACE-CAPITAL-README.md" ] && [ -f "PARALLAX-README.md" ]; then
    mv SPACE-CAPITAL-README.md _archive/docs-legacy/
    # Rename to standard README.md
    mv PARALLAX-README.md README.md
    echo "   ✓ PARALLAX-README.md → README.md"
    echo "   ✓ SPACE-CAPITAL-README.md → _archive/docs-legacy/"
elif [ -f "PARALLAX-README.md" ]; then
    mv PARALLAX-README.md README.md
    echo "   ✓ PARALLAX-README.md → README.md"
elif [ -f "SPACE-CAPITAL-README.md" ]; then
    mv SPACE-CAPITAL-README.md README.md
    echo "   ✓ SPACE-CAPITAL-README.md → README.md"
fi

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════"
echo "✅ Cleanup complete!"
echo ""
echo "📁 Final structure:"
echo ""
echo "  trading/"
echo "  ├── index.html          (Main app)"
echo "  ├── paint-bay.html      (Color customization tool)"
echo "  ├── parallax-run.html   (Racing mini-game)"
echo "  ├── README.md           (Project documentation)"
echo "  ├── assets/             (Ship sprites & images)"
echo "  ├── css/                (Stylesheets)"
echo "  ├── data/               (Market data JSON)"
echo "  ├── js/                 (JavaScript modules)"
echo "  └── _archive/           (Legacy files)"
echo "      ├── html-legacy/    (Old HTML pages)"
echo "      ├── html-demos/     (Dev test pages)"
echo "      ├── docs-legacy/    (Old documentation)"
echo "      └── docs-dev-logs/  (Build logs & reports)"
echo ""
echo "💡 TIP: You can delete _archive/ entirely once you've"
echo "   verified everything works correctly."
echo ""
