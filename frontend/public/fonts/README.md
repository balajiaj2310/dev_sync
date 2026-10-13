# DevSync Font Assets

This directory documents the font stack used throughout the DevSync frontend.

## Font Families

- **Headings & Brand Wordmarks**: `Space Grotesk` (weights: 600, 700, 800)
- **Body & UI Controls**: `Inter` (weights: 400, 500, 600, 700)
- **Code & Technical Metadata**: `JetBrains Mono` (weights: 400, 500, 700)

## Web Font Integration

Fonts are imported via secure Google Fonts CDN with reliable local system fallbacks:
`'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
`'JetBrains Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace`

Self-hosted WOFF2 files can be placed in this folder for fully offline/airgapped deployments.
