"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type React from "react";
import {
  ArrowLeft,
  BookOpen,
  KeyRound,
  LayoutDashboard,
  Package,
  MapPin,
  ScanLine,
  ShoppingCart,
  BarChart3,
  Bot,
  Settings,
  ListChecks,
  UserCircle2,
  Pencil,
  Upload,
  Users,
  Key,
  UserCog,
  Workflow,
  ShieldCheck,
  List,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type OutlineItem = {
  id: string;
  label: string;
  level: 1 | 2 | 3;
};

type Accent = "yellow" | "blue" | "lilac" | "green";

function accentVars(accent?: Accent) {
  switch (accent) {
    case "blue":
      return {
        solid: "var(--ug-accent-blue)",
        soft: "var(--ug-accent-blue-soft)",
      };
    case "lilac":
      return {
        solid: "var(--ug-accent-lilac)",
        soft: "var(--ug-accent-lilac-soft)",
      };
    case "green":
      return {
        solid: "var(--ug-accent-green)",
        soft: "var(--ug-accent-green-soft)",
      };
    case "yellow":
    default:
      return { solid: "var(--ug-accent)", soft: "var(--ug-accent-soft)" };
  }
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function SectionHeader({
  id,
  title,
  icon: Icon,
  accent = "yellow",
}: {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  accent?: Accent;
}) {
  const a = accentVars(accent);
  return (
    <div
      className="scroll-mt-24 mt-10 flex items-center gap-3 rounded-xl border border-[var(--ug-border)] bg-[var(--ug-surface-solid)] px-4 py-3 first:mt-0"
      style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.06)" }}
    >
      <div
        aria-hidden
        className="h-8 w-1 rounded-full"
        style={{ backgroundColor: a.solid }}
      />
      {Icon ? (
        <div
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: a.soft, color: a.solid }}
        >
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <h2 id={id} className="text-xl font-semibold text-[var(--ug-text)]">
        {title}
      </h2>
    </div>
  );
}

function SubHeader({
  id,
  title,
  icon: Icon,
}: {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <h3
      id={id}
      className="scroll-mt-24 mt-6 flex items-center gap-2 text-base font-semibold text-[var(--ug-text)]"
    >
      {Icon ? (
        <span
          aria-hidden
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--ug-hover)]"
        >
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <span>{title}</span>
    </h3>
  );
}

function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--ug-border)] bg-[var(--ug-surface-solid)] shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between border-b border-[var(--ug-border)] px-4 py-3">
        <div className="text-sm font-medium text-[var(--ug-text)]">
          Screenshot
        </div>
        <div className="text-xs text-[var(--ug-muted-2)]">Add image</div>
      </div>
      <div className="bg-[linear-gradient(90deg,var(--ug-accent-soft),transparent)] px-4 py-6">
        <div className="rounded-lg border border-dashed border-[var(--ug-border)] bg-white/60 px-4 py-6 text-sm text-[var(--ug-muted)]">
          [insert image here — {label}]
        </div>
      </div>
    </div>
  );
}

function Screenshot({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[var(--ug-border)] bg-[var(--ug-surface-solid)] shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="block bg-white/70 px-3 py-3"
      >
        <div className="flex w-full justify-center">
          <Image
            src={src}
            alt={alt}
            width={1920}
            height={1080}
            className="h-auto w-auto max-w-full rounded-lg"
            sizes="(max-width: 768px) 100vw, 900px"
            priority={false}
          />
        </div>
      </a>
    </div>
  );
}

export default function UserGuidePage() {
  const router = useRouter();

  const outline = useMemo<OutlineItem[]>(
    () => [
      { id: "overview", label: "Overview", level: 1 },
      { id: "login", label: "1) Login & Account Verification", level: 1 },
      { id: "dashboard", label: "2) Dashboard (Hub)", level: 1 },
      {
        id: "dashboard-profile",
        label: "Profile + Settings (top-right)",
        level: 2,
      },
      { id: "dashboard-left", label: "Left intro panel", level: 2 },
      { id: "dashboard-ai", label: "AI chatbot", level: 2 },
      { id: "inventory", label: "3) Inventory Management", level: 1 },
      { id: "inventory-edit", label: "Edit popup + images", level: 2 },
      { id: "bulk-upload", label: "Bulk Upload (two types)", level: 2 },
      { id: "bulk-upload-direct", label: "Full Bulk Upload", level: 3 },
      { id: "bulk-upload-shelf", label: "Shelf-based Upload", level: 3 },
      {
        id: "inventory-add-item",
        label: "Add Item (currently not used)",
        level: 2,
      },
      { id: "locations", label: "4) Location Tracking", level: 1 },
      { id: "ngc", label: "5) NGC Entry (Scan/Search)", level: 1 },
      { id: "ebay", label: "6) eBay Integration", level: 1 },
      { id: "ebay-active-listings", label: "Active listings", level: 2 },
      { id: "reports", label: "7) Reports", level: 1 },
      { id: "ai-assistant", label: "8) AI Assistant", level: 1 },
      { id: "ai-assistant-chart", label: "Charts (bar)", level: 2 },
      { id: "settings", label: "9) Settings (Admin)", level: 1 },
      { id: "settings-users", label: "User + Role Management", level: 2 },
      { id: "settings-roles", label: "Role Management", level: 2 },
      { id: "settings-api", label: "System Settings", level: 2 },
      {
        id: "settings-profile",
        label: "Reset password",
        level: 2,
      },
      { id: "flows", label: "10) Quick User Flows", level: 1 },
      { id: "flow-ngc", label: "Flow: Add ONE coin (NGC)", level: 2 },
      { id: "flow-direct", label: "Flow: Bulk Upload (Direct)", level: 2 },
      { id: "flow-shelf", label: "Flow: Bulk Upload (Shelf-based)", level: 2 },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-[var(--ug-bg)] text-[var(--ug-text)]">
      <header className="sticky top-0 z-50 border-b border-[var(--ug-border)] bg-[var(--ug-surface)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to dashboard"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <p className="text-sm font-semibold leading-tight text-[var(--ug-text)]">
                User Guide
              </p>
              <p className="text-xs leading-tight text-[var(--ug-muted-2)]">
                Collectibles Inventory — Staff Workflow
              </p>
            </div>
          </div>

          <div className="text-xs text-[var(--ug-muted-2)]">
            Tip: Use the Outline on the left to jump to a section
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[280px_1fr]">
        <aside className="md:sticky md:top-[64px] md:h-[calc(100vh-64px-24px)]">
          <div className="h-full overflow-auto rounded-xl border border-[var(--ug-border)] bg-[var(--ug-surface-solid)] shadow-[0_10px_30px_rgba(0,0,0,0.06)]">
            <div className="border-b border-[var(--ug-border)] px-4 py-3">
              <p className="text-sm font-semibold">Outline</p>
              <p className="text-xs text-[var(--ug-muted-2)]">Click to jump</p>
            </div>
            <nav className="p-2">
              {outline.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToId(item.id)}
                  className={[
                    "w-full rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--ug-hover)]",
                    item.level === 1
                      ? "font-medium text-[var(--ug-text)]"
                      : "text-[var(--ug-muted)]",
                    item.level === 2 ? "pl-6" : "",
                    item.level === 3 ? "pl-10 text-[var(--ug-muted-2)]" : "",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="rounded-xl border border-[var(--ug-border)] bg-[var(--ug-surface-solid)] shadow-[var(--ug-shadow)]">
            <div className="border-b border-[var(--ug-border)] px-6 py-4">
              <h1 className="text-2xl font-semibold">
                Collectibles Inventory — Staff User Guide
              </h1>
              <p className="mt-1 text-sm text-[var(--ug-muted)]">
                Plain-language instructions for non-technical staff.
              </p>
            </div>

            <div className="px-6 py-6">
              <SectionHeader
                id="overview"
                title="Overview"
                icon={BookOpen}
                accent="lilac"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                This guide explains what to do and where to click across the
                system. Use the Outline on the left to jump to any section.
              </p>

              <SectionHeader
                id="login"
                title="Login & Account Verification (Google Firebase)"
                icon={KeyRound}
                accent="yellow"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                This system uses Google Firebase authentication. Before you can
                use the app, you must verify your account. If you have not
                verified your email, you may not be able to log in.
              </p>
              <div className="mt-3 text-sm text-[var(--ug-muted)]">
                <div className="font-medium text-[var(--ug-text)]">
                  If you didn’t receive the verification email
                </div>
                <div className="mt-1">1) Check spam/junk</div>
                <div>2) Contact your Admin to resend/recreate your account</div>
              </div>
              <Screenshot src="/user-guide/login.png" alt="Login screen" />

              <SectionHeader
                id="dashboard"
                title="Dashboard (Hub)"
                icon={LayoutDashboard}
                accent="blue"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                After login, you land on the Dashboard. Each block opens a
                module (Inventory, Locations, NGC Entry, eBay, Reports, AI
                Assistant). If a block is missing or disabled, it usually means
                your role does not have access.
              </p>
              <Screenshot
                src="/user-guide/dashboard-blocks.png"
                alt="Dashboard blocks"
              />

              <SubHeader
                id="dashboard-profile"
                title="Top-right: Profile + Settings"
                icon={UserCircle2}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                The top-right corner has your profile icon. From there, you can
                view your profile and sign out. The Settings option may or may
                not be visible depending on your role.
              </p>
              <Screenshot
                src="/user-guide/dashboard-profile-dropdown.png"
                alt="Dashboard profile dropdown"
              />

              <SubHeader
                id="dashboard-left"
                title="Left panel: Intro to each block"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                When you highlight a dashboard block, the left panel explains
                what that module is used for.
              </p>

              <SubHeader id="dashboard-ai" title="AI Chatbot" icon={Bot} />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                You can use the AI chatbot to ask questions like “Show items
                added this week” or “How many items are on Shelf 1?”.
              </p>
              <Screenshot
                src="/user-guide/ai-floating-widget-answer.png"
                alt="AI floating widget answering"
              />

              <SectionHeader
                id="inventory"
                title="Inventory Management"
                icon={Package}
                accent="green"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Inventory Management is the main list of coins/items. You can
                search, filter, and open an item to view details.
              </p>
              <Screenshot
                src="/user-guide/inventory-list-filters.png"
                alt="Inventory list with filters"
              />

              <SubHeader
                id="inventory-edit"
                title="Edit popup + item images"
                icon={Pencil}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Clicking an item opens a pop-up where you can edit details (like
                name, price, status) and view coin/item images.
              </p>
              <Screenshot
                src="/user-guide/edit-popup.png"
                alt="Inventory item edit popup"
              />

              <SubHeader
                id="bulk-upload"
                title="Bulk Upload (two types)"
                icon={Upload}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Bulk Upload helps you add many items at once. There are two
                options: Direct Upload and Shelf-based Upload.
              </p>

              <h4
                id="bulk-upload-direct"
                className="scroll-mt-24 mt-5 text-sm font-semibold text-[var(--ug-text)]"
              >
                Full Bulk Upload
              </h4>
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Use this when you only have Cert ID and price. After upload, the
                system contacts NGC to fetch item information and saves it. It
                also shows duplicates if the certificate already exists.
              </p>
              <div className="mt-3 text-sm text-[var(--ug-muted)]">
                <div className="font-medium text-[var(--ug-text)]">Steps</div>
                <div className="mt-1">
                  1) Inventory → Bulk Upload → Direct Upload
                </div>
                <div>2) Upload Excel with Cert ID + Price</div>
                <div>3) Review results (duplicates / errors)</div>
              </div>
              <Screenshot
                src="/user-guide/bulk-upload-full.png"
                alt="Bulk upload - full upload"
              />

              <h4
                id="bulk-upload-shelf"
                className="scroll-mt-24 mt-6 text-sm font-semibold text-[var(--ug-text)]"
              >
                Shelf-based Upload
              </h4>
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Use this when you want items placed into a specific shelf and
                include location details like row and slot. You choose a shelf,
                download the template, fill in cert details + row/slot, then
                upload. The system contacts NGC and saves the items with their
                locations.
              </p>
              <div className="mt-3 text-sm text-[var(--ug-muted)]">
                <div className="font-medium text-[var(--ug-text)]">Steps</div>
                <div className="mt-1">
                  1) Inventory → Bulk Upload → Shelf-based Upload
                </div>
                <div>2) Select Shelf → Download Template</div>
                <div>3) Fill Cert + Price + Row + Slot</div>
                <div>4) Upload → Review summary</div>
              </div>
              <Screenshot
                src="/user-guide/bulk-upload-shelf.png"
                alt="Bulk upload - shelf based"
              />

              <SubHeader
                id="inventory-add-item"
                title="Add Item (currently not used)"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                There is an Add Item block/button that may not respond. The team
                is still deciding whether this feature will be used. For now,
                add items using NGC Entry or Bulk Upload.
              </p>

              <SectionHeader
                id="locations"
                title="Location Tracking"
                icon={MapPin}
                accent="lilac"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Location Tracking is used to view the storage hierarchy (Site →
                Room → Shelf → Box → Row → Slot) and see what items are stored
                where. Note: moving items to the correct spot is not configured
                here right now.
              </p>
              <Screenshot
                src="/user-guide/locations.png"
                alt="Locations page"
              />

              <SectionHeader
                id="ngc"
                title="NGC Entry (Barcode Scan + Cert Search)"
                icon={ScanLine}
                accent="blue"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                NGC Entry supports barcode scan and cert-number search. Both
                methods contact NGC using the certificate number and pull
                details automatically.
              </p>
              <div className="mt-3 text-sm text-[var(--ug-muted)]">
                <div className="font-medium text-[var(--ug-text)]">Steps</div>
                <div className="mt-1">1) Dashboard → NGC Entry</div>
                <div>2) Scan barcode or type the cert number</div>
                <div>3) Review preview → Confirm/Save</div>
              </div>
              <Screenshot src="/user-guide/ngc.png" alt="NGC entry" />

              <SectionHeader
                id="ebay"
                title="eBay Integration"
                icon={ShoppingCart}
                accent="yellow"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Use eBay Integration to create listings, update existing
                listings, and check sync status.
              </p>
              <div className="mt-3 text-sm text-[var(--ug-muted)]">
                <div className="font-medium text-[var(--ug-text)]">
                  Common steps
                </div>
                <div className="mt-1">1) Dashboard → eBay</div>
                <div>2) Create Listing tab → select item</div>
                <div>3) Review details → Create/Update listing</div>
                <div>4) Check Dashboard/Sync Status tabs</div>
              </div>
              <Screenshot
                src="/user-guide/ebay-create-listing.png"
                alt="eBay create listing"
              />

              <SubHeader
                id="ebay-active-listings"
                title="Active Listings"
                icon={List}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Use the Dashboard/Active Listings view to see what is currently
                listed, and click through to view listings on eBay.
              </p>
              <Screenshot
                src="/user-guide/ebay-active-listings.png"
                alt="eBay active listings"
              />

              <SectionHeader
                id="reports"
                title="Reports"
                icon={BarChart3}
                accent="green"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Reports provide summaries such as totals, breakdowns, and
                filters for quick review.
              </p>
              <ImagePlaceholder label="Reports dashboard" />

              <SectionHeader
                id="ai-assistant"
                title="AI Assistant"
                icon={Bot}
                accent="blue"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                AI Assistant answers questions in plain language. Ask about
                counts, value, locations, sold items, or recent additions.
              </p>
              <SubHeader
                id="ai-assistant-chart"
                title="Chart output (bar chart)"
                icon={BarChart3}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Some answers include charts. Use the tabs (Summary/Table/Bar) to
                switch views.
              </p>
              <Screenshot
                src="/user-guide/ai-assistant-bar-chart.png"
                alt="AI assistant bar chart"
              />

              <SectionHeader
                id="settings"
                title="Settings (Admin)"
                icon={Settings}
                accent="lilac"
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Settings is for Admin/power users. Visibility depends on your
                role. It includes User/Role Management, System Settings, and API
                settings.
              </p>
              <Screenshot
                src="/user-guide/settings-page.png"
                alt="Settings page"
              />

              <SubHeader
                id="settings-users"
                title="User + Role Management"
                icon={Users}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Admins can add users, assign roles, and control what each role
                can access.
              </p>
              <Screenshot
                src="/user-guide/user-management.png"
                alt="User management"
              />

              <SubHeader
                id="settings-roles"
                title="Role Management"
                icon={ShieldCheck}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Role Management is used to define what each role can access
                (View/Create/Edit/Delete) across modules.
              </p>
              <Screenshot
                src="/user-guide/role-management.png"
                alt="Role management"
              />

              <SubHeader id="settings-api" title="System Settings" icon={Key} />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                System settings may include updating passwords and tokens used
                for integrations. Only users with the correct role will see
                these options.
              </p>
              <Screenshot
                src="/user-guide/system-settings.png"
                alt="System settings"
              />

              <SubHeader
                id="settings-profile"
                title="Reset Password"
                icon={UserCog}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                If you forgot your password, use Reset Password to send a reset
                link to your email.
              </p>
              <Screenshot
                src="/user-guide/reset-password.png"
                alt="Reset password"
              />

              <SectionHeader
                id="flows"
                title="Quick User Flows"
                icon={ListChecks}
                accent="green"
              />

              <SubHeader
                id="flow-ngc"
                title="Flow: Add ONE coin (NGC)"
                icon={Workflow}
              />
              <p className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                Dashboard → NGC Entry → Scan/Search cert → Preview → Confirm →
                Check Inventory.
              </p>
              <ImagePlaceholder label="NGC flow collage" />

              <SubHeader
                id="flow-direct"
                title="Flow: Bulk Upload (Direct)"
                icon={Workflow}
              />
              <div className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                <div className="font-medium text-[var(--ug-text)]">
                  What you’re setting up
                </div>
                <div className="mt-1">
                  Use this when you want to bulk-create items by cert number,
                  and you do not need to place them into a specific shelf/slot
                  during the upload.
                </div>
                <div className="mt-3 font-medium text-[var(--ug-text)]">
                  Steps
                </div>
                <div className="mt-1">1) Inventory → Bulk Upload</div>
                <div>2) Open the Full Bulk Upload tab</div>
                <div>
                  3) Upload an Excel/CSV with columns: certificate_numbers,
                  price
                </div>
                <div>4) Review results: success, duplicates, errors</div>
                <div>
                  5) After completion, verify items in Inventory Management
                </div>
                <div className="mt-3 font-medium text-[var(--ug-text)]">
                  What happens in the system
                </div>
                <div className="mt-1">
                  For each certificate number, the app checks if it already
                  exists. If not, it calls NGC lookup, creates the item, and
                  saves it with the price you provided.
                </div>
              </div>
              <ImagePlaceholder label="Direct bulk upload flow collage" />

              <SubHeader
                id="flow-shelf"
                title="Flow: Bulk Upload (Shelf-based)"
                icon={Workflow}
              />
              <div className="mt-2 text-sm leading-6 text-[var(--ug-muted)]">
                <div className="font-medium text-[var(--ug-text)]">
                  What you’re setting up
                </div>
                <div className="mt-1">
                  Use this when you want to bulk-create items AND assign each
                  item into a specific shelf layout (box/row/slot) as part of
                  the upload.
                </div>
                <div className="mt-3 font-medium text-[var(--ug-text)]">
                  Steps
                </div>
                <div className="mt-1">1) Inventory → Bulk Upload</div>
                <div>2) Open Shelf-Based Bulk Load</div>
                <div>3) Select a Shelf (Site → Room → Shelf)</div>
                <div>
                  4) Download the shelf template (it is generated for that
                  shelf’s slots)
                </div>
                <div>
                  5) Fill ONLY the EMPTY rows with cert_num and price (do not
                  edit FILLED rows)
                </div>
                <div>6) Upload the completed template</div>
                <div>
                  7) Review validation summary and process accepted rows
                </div>
                <div className="mt-3 font-medium text-[var(--ug-text)]">
                  What happens in the system
                </div>
                <div className="mt-1">
                  The template ties each row to a specific slot. Accepted rows
                  are created via NGC lookup, then the item is assigned to the
                  selected slot so your inventory is immediately location-aware.
                </div>
              </div>
              <ImagePlaceholder label="Shelf-based bulk upload flow collage" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
