# UI DESIGN SPECIFICATION
> Design System & Layout Guide for Developer / AI Code Implementation

---

## 🎨 1. Color Palette & Theme

This design uses a **Clean Light Mode** theme with high contrast between the sidebar and main content cards.

### Background Colors
| Element                  | Color Value |
|--------------------------|-------------|
| Main App Background      | Off-white / Very light gray — `#F2F5F9` |
| Sidebar Background       | Dark charcoal gray — `#2B2D33` |
| Main Card Background     | Pure white — `#FFFFFF` |
| Dark Card (Credit Card)  | Dark charcoal gray — `#2B2D33` |

### Accent Colors
| Role                           | Color Value |
|--------------------------------|-------------|
| Primary (Buttons, Charts)      | Pastel blue — `#78A3FF` |
| Solid Dark (Chart fill)        | Near-black — `#1A1A1A` |

### Typography Colors
| Usage                          | Color Value |
|--------------------------------|-------------|
| Heading / Monetary Values      | `#1A1A1A` or `#000000` |
| Sub-text / Labels              | Medium gray — `#9CA3AF` or `#8A8D93` |
| Text on Dark Cards             | White — `#FFFFFF` |

### Status Badge / Pill Colors
| Status  | Background  | Text Color |
|---------|-------------|------------|
| Success | `#D1F0D9`   | `#198754`  |
| Process | `#E5E7EB`   | Dark gray  |
| Failed  | `#FDE0DD`   | `#DC3545`  |

---

## 📐 2. Layout Structure

The dashboard uses a **fixed-container / full-view** layout built with CSS Grid and Flexbox.

### A. Root Layout
```
display: flex;
flex-direction: row;
height: 100vh;
```

| Region        | Behavior                                                        |
|---------------|-----------------------------------------------------------------|
| Left Sidebar  | Fixed width — `80px` (icon-only / collapsed) or `250px` (with labels) — full height `100vh` |
| Main Content  | `flex: 1` — fills remaining horizontal space |

---

### B. Main Content Area

#### Top Bar (Header)
```
display: flex;
justify-content: space-between;
align-items: center;
```
| Position | Content                  |
|----------|--------------------------|
| Left     | Greeting / Short profile |
| Center   | Search bar               |
| Right    | "My Account" dropdown    |

---

#### Dashboard Body Grid
Split into **two main columns** at approximately a **65% : 35% ratio**.

```
display: grid;
grid-template-columns: 65fr 35fr;
gap: 24px;
```

**Left Column (Main Data):**
- **Cards Section** — 2-column grid:
  - Card 1: Primary balance (e.g., `$15,780.0`)
  - Card 2: Secondary balance (e.g., `₴ 123,424.0`)
- **Quick Actions** — Flex row with even gap:
  - Buttons: Transfer · Utility · Taxes · Transport
- **Recent Sales** — List/table, each row built with Flexbox:
  ```
  [Avatar/Icon] — [Name + Date] — [Amount] — [Status Badge]
  ```

**Right Column (Statistics):**
- One tall white card spanning the full column height, divided into two sections:
  - **Top section:** Doughnut/donut chart
  - **Bottom section:** Expense history list, each row structured as:
    ```
    [Icon] — [Label + Description] — [Amount]
    ```
    Examples: Spotify, Apple, etc.

---

## ✨ 3. UI Style Guide

### Typography
- Font family: Clean, rounded, modern **sans-serif**
  - Recommended: **Poppins**, **Inter**, or **Plus Jakarta Sans**
- Font weight rules:
  - `600` / `700` — monetary values and headings (visual focal point)
  - `400` — labels, secondary text, and descriptions

---

### Border Radius
This design heavily emphasizes **soft, rounded corners** throughout.

| Element                          | Border Radius Value          |
|----------------------------------|------------------------------|
| Outer Dashboard Container        | `~30px`                      |
| Main Cards & Sidebar             | `~24px`                      |
| Action Buttons & Search Bar      | Pill-shaped — `9999px`       |
| Icon Containers (Spotify, Apple) | Full circle — `50%`          |

---

### Box Shadow
Use very subtle, diffused drop shadows **only on white cards** to create a lifted appearance against the light gray background.

```css
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
```

Do NOT apply heavy or dark shadows anywhere — keep shadows nearly invisible.

---

### Spacing (Padding & Margin)
Provide generous breathing room throughout the layout.

| Context                                 | Value       |
|-----------------------------------------|-------------|
| Inner padding of white cards            | `24px–32px` |
| Gap between left and right columns      | `24px`      |
| Gap between rows / stacked elements     | `24px`      |

---

## 🧩 4. Component Architecture Notes

> **For Developer / AI Implementation:**

- The **Recent Sales** list and the **Statistics expense list** share an identical repeating row structure.  
  Build them as a **reusable component** — only the icon, name, date, amount, and status/badge differ per row.

  Suggested reusable component props:
  ```ts
  type TransactionRowProps = {
    icon: ReactNode;
    label: string;
    date: string;
    amount: string;
    status?: 'success' | 'process' | 'failed'; // optional, for Recent Sales
  };
  ```

- Quick Action buttons should also be a **reusable component** accepting `icon` and `label` as props.