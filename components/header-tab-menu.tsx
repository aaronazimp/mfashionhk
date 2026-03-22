"use client";

import Link from "next/link";
import React from "react";
import { usePathname } from "next/navigation";

type Props = {
  active?: "orders" | "upload" | "skus" | "best-sellers" | "history" | "restock" | "orders-follow";
};

export function HeaderTabMenu({ active }: Props) {
  const [open, setOpen] = React.useState(false);
  const ordersWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const ordersMenuRef = React.useRef<HTMLDivElement | null>(null);
  const base = "flex-shrink-0 md:flex-initial w-full md:w-auto px-2 md:px-4 py-2 md:py-2 rounded text-md md:text-sm text-left hover:bg-white/50 transition-colors";
  const [submenuOpen, setSubmenuOpen] = React.useState(false);

  const items: Array<
    | { key: string; label: string; submenu: true }
    | { href: string; key: string; label: string }
  > = [
    { key: "orders", label: "處理訂單", submenu: true },
    { href: "/admin/upload", key: "upload", label: "上傳商品" },
    { href: "/admin/skus", key: "skus", label: "管理商品" },
    { href: "", key: "best-sellers", label: "熱賣商品(即將推出)" },
  ];

  const ordersSubitems = [
    
    { href: "/admin/orders/restock", key: "restock", label: "補貨管理" },
    { href: "/admin/orders", key: "orders-follow", label: "訂單跟進" },
    { href: "/admin/orders/history", key: "history", label: "訂單記錄" },
  ];

  const pathname = usePathname();

  const derivedActive = React.useMemo(() => {
    if (!pathname) return active;
    if (pathname.startsWith("/admin/orders/restock")) return "restock" as Props["active"];
    if (pathname.startsWith("/admin/orders/history")) return "history" as Props["active"];
    if (pathname.startsWith("/admin/orders")) return "orders-follow" as Props["active"];
    return active;
  }, [pathname, active]);

  const currentActive = derivedActive ?? active;

  const isActiveOrdersTop = currentActive === "orders" || currentActive === "history" || currentActive === "restock" || currentActive === "orders-follow";

  React.useEffect(() => {
    if (isActiveOrdersTop) {
      setSubmenuOpen(true);
    }
  }, [isActiveOrdersTop]);

  React.useLayoutEffect(() => {
    function updatePosition() {
      const wrap = ordersWrapperRef.current;
      const menu = ordersMenuRef.current;
      if (!wrap || !menu) return;
      const rect = wrap.getBoundingClientRect();
      menu.style.position = 'fixed';
      menu.style.left = `${rect.left}px`;
      menu.style.top = `${rect.bottom}px`;
      menu.style.zIndex = '9999';
    }

    if (submenuOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [submenuOpen]);

  return (
    <div className="relative">
      {/* Mobile full-width top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-white h-14">
        <div className="max-w-6xl mx-auto px-4 flex items-center h-14">
          <button
            aria-expanded={open}
            aria-controls="header-tab-menu-mobile"
            onClick={() => setOpen((s) => !s)}
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            <span className="sr-only">Toggle menu</span>
            {open ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
          {/* Centered title fixed to viewport center, does not block the burger */}
          <div className="absolute left-1/2 top-0 bottom-0 transform -translate-x-1/2 flex items-center justify-center pointer-events-none">
            <div className="text-sm font-medium text-gray-800 pointer-events-none">
              {(() => {
                const it = items.find((i) => i.key === currentActive || ('href' in i && i.key === currentActive));
                if (it) return it.label;
                const sub = ordersSubitems.find((s) => s.key === currentActive);
                return sub ? sub.label : '';
              })()}
            </div>
          </div>
          
        </div>
      </div>
      <div/>
      {/* Desktop fixed bar (full-width on md+) */}
      <div className="md:fixed md:top-0 md:left-0 md:right-0 md:z-50 md:bg-white/80 md:backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4">

          {/* Desktop: horizontal tabs */}
          <nav className="hidden md:flex overflow-x-auto whitespace-nowrap gap-1 md:gap-2 bg-gray-50 p-1 rounded-lg border border-gray-200 w-auto shadow-sm">
      {items.map((it) => {
          if ("submenu" in it) {
            return (
              <div key={it.key} className="relative" ref={it.key === 'orders' ? ordersWrapperRef : undefined}>
                    <button
                      onClick={() => setSubmenuOpen((s) => !s)}
                      aria-expanded={submenuOpen}
                      aria-haspopup="true"
                      className={`${base} flex items-center justify-between ${isActiveOrdersTop ? 'font-medium underline decoration-2 underline-offset-4 decoration-[#C4A59D]' : 'text-[#111827]'}`}
                    >
                      <span className="flex-1 text-left">{it.label}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        className={`h-4 w-4 ml-2 transform transition-transform duration-150 ${submenuOpen ? 'rotate-180' : 'rotate-0'}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8l4 4 4-4" />
                      </svg>
                    </button>

                <div
                  ref={it.key === 'orders' ? ordersMenuRef : undefined}
                  className={`absolute left-0 mt-2 w-44 bg-white rounded shadow-lg border border-gray-200 transition-opacity ${submenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                  onMouseLeave={() => setSubmenuOpen(false)}
                >
                  <div className="flex flex-col py-1">
                    {ordersSubitems.map((s) => (
                      <Link
                        key={s.key}
                        href={s.href}
                        className={`px-3 py-2 text-sm hover:bg-gray-100 ${currentActive === s.key ? 'font-medium underline decoration-2 underline-offset-4 decoration-[#C4A59D]' : 'text-gray-700'}`}
                        onClick={() => setSubmenuOpen(false)}
                      >
                        {s.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={it.key}
              href={it.href}
              className={`${base} ${currentActive === it.key ? 'font-medium underline decoration-2 underline-offset-4 decoration-[#C4A59D]' : 'text-[#111827]'}`}
            >
              {it.label}
            </Link>
          );
        })}
          </nav>

        </div>
      </div>

      {/* Spacer so page content isn't covered by the fixed desktop bar */}
      <div className="hidden md:block h-10" />

      {/* Mobile: sliding drawer from left with overlay */}
      <div className={`fixed inset-0 z-40 md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-hidden={!open}>
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 z-40 ${open ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setOpen(false)}
        />

        <aside
          id="header-tab-menu-mobile"
            className={`absolute top-0 left-0 h-full w-64 bg-gray-50 border-r border-gray-200 pt-12 px-4 pb-12 transform transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : '-translate-x-full'} z-50 overflow-auto`}
          aria-hidden={!open}
        >
          <nav className="flex flex-col gap-1">
            {items.map((it) => {
              if ("submenu" in it) {
                return (
                  <div key={it.key} className=" flex flex-col gap-1">
                    <button
                      onClick={() => setSubmenuOpen((s) => !s)}
                      aria-expanded={submenuOpen}
                      aria-haspopup="true"
                      className={`${base} flex items-center justify-between ${isActiveOrdersTop ? 'font-medium underline decoration-2 underline-offset-4 decoration-[#C4A59D]' : 'text-[#111827]'}`}
                    >
                      <span className="flex-1 text-left">{it.label}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        className={`h-4 w-4 ml-2 transform transition-transform duration-150 ${submenuOpen ? 'rotate-180' : 'rotate-0'}`}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8l4 4 4-4" />
                      </svg>
                    </button>

                    {submenuOpen && (
                      <div className="pl-4 flex flex-col gap-1">
                        {ordersSubitems.map((s) => (
                          <Link
                            key={s.key}
                            href={s.href}
                            onClick={() => {
                              setOpen(false);
                              setSubmenuOpen(false);
                            }}
                            className={`${base} text-sm py-2 pl-2 pr-4 rounded-lg ${currentActive === s.key ? 'font-medium underline decoration-2 underline-offset-4 decoration-[#C4A59D]' : 'text-[#111827]'}`}
                          >
                            {s.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={it.key}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={`${base} ${currentActive === it.key ? 'font-medium underline decoration-2 underline-offset-4 decoration-[#C4A59D]' : 'text-[#111827]'}`}
                >
                  {it.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={() => setOpen(false)}
            aria-label="收起"
            className="absolute bottom-4 right-4 text-primary text-xs px-3 py-1.5  z-50"
          >
            收起
          </button>
        </aside>
      </div>
    </div>
  );
}

export default HeaderTabMenu;
