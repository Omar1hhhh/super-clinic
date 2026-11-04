import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { clinic, copy, doctors, photos, services, type Doctor, type Language, type Service } from "./data";

type Page = "home" | "about" | "services" | "service" | "doctors" | "doctor" | "appointment" | "contact" | "privacy" | "notFound";
type Route = { lang: Language; page: Page; slug?: string };

function readRoute(pathname: string): Route {
  const basePath = import.meta.env.BASE_URL;
  const appPath = basePath === "/" || !pathname.startsWith(basePath)
    ? pathname
    : `/${pathname.slice(basePath.length)}`;
  const parts = appPath.split("/").filter(Boolean);
  const lang: Language = parts[0] === "en" ? "en" : "ar";
  const section = parts[1] ?? "";
  if (section === "about") return { lang, page: "about" };
  if (section === "services") return parts[2] ? { lang, page: "service", slug: parts[2] } : { lang, page: "services" };
  if (section === "doctors") return parts[2] ? { lang, page: "doctor", slug: parts[2] } : { lang, page: "doctors" };
  if (section === "appointment") return { lang, page: "appointment" };
  if (section === "contact") return { lang, page: "contact" };
  if (section === "privacy") return { lang, page: "privacy" };
  if (!section) return { lang, page: "home" };
  return { lang, page: "notFound" };
}

function routePath(route: Route): string {
  const prefix = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/${route.lang}`;
  if (route.page === "home") return `${prefix}/`;
  if (route.page === "service" && route.slug) return `${prefix}/services/${route.slug}`;
  if (route.page === "doctor" && route.slug) return `${prefix}/doctors/${route.slug}`;
  if (route.page === "notFound") return `${prefix}/not-found`;
  return `${prefix}/${route.page}`;
}

function photoUrl(id: string, _width = 1100): string {
  return `${import.meta.env.BASE_URL}images/${id}.svg`;
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

function useLocalNavigation() {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  useEffect(() => {
    const updatePath = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);
  const navigate = useCallback((path: string) => {
    if (path === window.location.pathname) return;
    window.history.pushState({}, "", path);
    setPathname(path);
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.scrollTo({ top: 0, behavior });
  }, []);
  return { route: readRoute(pathname), navigate };
}

type RouteLinkProps = {
  route: Route;
  navigate: (path: string) => void;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  ariaLabel?: string;
  ariaCurrent?: "page";
};

function RouteLink({ route, navigate, className, children, onNavigate, ariaLabel, ariaCurrent }: RouteLinkProps) {
  return (
    <a
      href={routePath(route)}
      className={className}
      aria-label={ariaLabel}
      aria-current={ariaCurrent}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigate(routePath(route));
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}

function App() {
  const { route, navigate } = useLocalNavigation();
  const t = copy[route.lang];

  useEffect(() => {
    document.documentElement.lang = route.lang;
    document.documentElement.dir = route.lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = "light";
    const pageTitle = titleFor(route);
    document.title = pageTitle;
    const description = route.page === "service" || route.page === "doctor"
      ? t.meta[route.page === "service" ? "services" : "doctors"]
      : t.meta[route.page];
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", pageTitle);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);

    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (clinic.siteUrl) {
      const link = canonical ?? document.createElement("link");
      link.rel = "canonical";
      link.href = `${clinic.siteUrl.replace(/\/$/, "")}${routePath(route)}`;
      if (!canonical) document.head.append(link);
    } else {
      canonical?.remove();
    }
  }, [route, t.meta]);

  const switchLanguage = () => navigate(routePath({ ...route, lang: route.lang === "ar" ? "en" : "ar" }));

  return (
    <div className={`site-shell${route.page === "home" ? " landing-page" : ""}`}>
      <a className="skip-link" href="#main">{route.lang === "ar" ? "انتقل إلى المحتوى" : "Skip to content"}</a>
      <Header route={route} navigate={navigate} onLanguageChange={switchLanguage} />
      <main id="main">
        {route.page === "home" && <HomePage lang={route.lang} navigate={navigate} />}
        {route.page === "about" && <AboutPage lang={route.lang} navigate={navigate} />}
        {route.page === "services" && <ServicesPage lang={route.lang} navigate={navigate} />}
        {route.page === "service" && <ServicePage lang={route.lang} slug={route.slug} navigate={navigate} />}
        {route.page === "doctors" && <DoctorsPage lang={route.lang} navigate={navigate} />}
        {route.page === "doctor" && <DoctorPage lang={route.lang} slug={route.slug} navigate={navigate} />}
        {route.page === "appointment" && <AppointmentPage lang={route.lang} />}
        {route.page === "contact" && <ContactPage lang={route.lang} navigate={navigate} />}
        {route.page === "privacy" && <PrivacyPage lang={route.lang} navigate={navigate} />}
        {route.page === "notFound" && <NotFound lang={route.lang} navigate={navigate} />}
      </main>
      <Footer lang={route.lang} navigate={navigate} />
      <MobileContactBar lang={route.lang} />
    </div>
  );
}

function titleFor(route: Route): string {
  const name = clinic.name[route.lang];
  if (route.page === "service") {
    const service = services.find((item) => item.slug === route.slug);
    return service ? `${service.title[route.lang]} | ${name}` : `${name}`;
  }
  if (route.page === "doctor") {
    const doctor = doctors.find((item) => item.slug === route.slug);
    return doctor ? `${doctor.name[route.lang]} | ${name}` : `${name}`;
  }
  const pageTitles = {
    ar: {
      home: "أفينورا | نموذج تجريبي خيالي",
      about: "عن مشروع أفينورا الخيالي",
      services: "خدمات توضيحية",
      service: "الخدمات",
      doctors: "شخصيات خيالية",
      doctor: "الفريق الطبي",
      appointment: "نموذج موعد تجريبي",
      contact: "تواصل تجريبي",
      privacy: "الخصوصية",
      notFound: "الصفحة غير متاحة",
    },
    en: {
      home: "Fictional dental portfolio demo",
      about: "About the fictional Avenora concept",
      services: "Sample dental services",
      service: "Services",
      doctors: "Fictional demo profiles",
      doctor: "Medical team",
      appointment: "Demo appointment form",
      contact: "Demo contact page",
      privacy: "Privacy",
      notFound: "Page unavailable",
    },
  };
  return `${pageTitles[route.lang][route.page]} | ${name}`;
}

function Header({
  route,
  navigate,
  onLanguageChange,
}: {
  route: Route;
  navigate: (path: string) => void;
  onLanguageChange: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const t = copy[route.lang];
  const nav: { page: Page; label: string }[] = [
    { page: "home", label: t.nav.home },
    { page: "about", label: t.nav.about },
    { page: "services", label: t.nav.services },
    { page: "doctors", label: t.nav.doctors },
    { page: "contact", label: t.nav.contact },
  ];
  const activePage = route.page === "service" ? "services" : route.page === "doctor" ? "doctors" : route.page;

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <>
      <div className="utility-bar">
        <div className="utility-inner page-width">
          <span>{clinic.city[route.lang]}</span>
          <span className="utility-hours"><span>{t.utility.hours}</span><b>{clinic.hours[route.lang]}</b></span>
          <RouteLink route={{ lang: route.lang, page: "contact" }} navigate={navigate}>{t.utility.contact}</RouteLink>
        </div>
      </div>
      <header className="site-header">
        <div className="header-inner page-width">
          <RouteLink route={{ lang: route.lang, page: "home" }} navigate={navigate} className="brand" ariaLabel={clinic.name[route.lang]}>
            <span className="brand-copy brand-copy-logo">
              <strong>{clinic.shortName[route.lang]}</strong>
              <small>{clinic.descriptor[route.lang]}</small>
            </span>
          </RouteLink>
          <button
            type="button"
            className="menu-toggle"
            ref={menuButtonRef}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="menu-lines" aria-hidden="true"><i /><i /></span>
            <span>{menuOpen ? (route.lang === "ar" ? "إغلاق" : "Close") : (route.lang === "ar" ? "القائمة" : "Menu")}</span>
          </button>
          <nav id="primary-navigation" className={`primary-navigation${menuOpen ? " is-open" : ""}`} aria-label={route.lang === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
            {nav.map((item) => (
              <RouteLink
                key={item.page}
                route={{ lang: route.lang, page: item.page }}
                navigate={navigate}
                className={`nav-link${activePage === item.page ? " is-current" : ""}`}
                onNavigate={() => setMenuOpen(false)}
                ariaCurrent={activePage === item.page ? "page" : undefined}
              >
                {item.label}
              </RouteLink>
            ))}
            <div className="mobile-nav-actions">
              <RouteLink route={{ lang: route.lang, page: "appointment" }} navigate={navigate} className="button button-primary" onNavigate={() => setMenuOpen(false)}>{t.nav.appointment}</RouteLink>
            </div>
          </nav>
          <div className="header-actions">
            <button type="button" className="text-button language-button" onClick={() => { onLanguageChange(); setMenuOpen(false); }} aria-label={route.lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}>
              {route.lang === "ar" ? "EN" : "ع"}
            </button>
            <RouteLink route={{ lang: route.lang, page: "appointment" }} navigate={navigate} className="button button-primary desktop-appointment">{t.nav.appointment}</RouteLink>
          </div>
        </div>
      </header>
    </>
  );
}

function SectionHeading({ title, body, className = "" }: { title: string; body?: string; className?: string }) {
  return (
    <div className={`section-heading ${className}`}>
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}

function HomePage({ lang, navigate }: { lang: Language; navigate: (path: string) => void }) {
  const t = copy[lang];
  const featuredServices = services.slice(0, 4);
  const featuredDoctors = doctors;
  return (
    <>
      <section className="hero-section page-width">
        <div className="hero-copy">
          <p className="hero-eyebrow">{t.home.eyebrow}</p>
          <h1>{t.home.headline}</h1>
          <p className="hero-intro">{t.home.intro}</p>
          <div className="hero-actions">
            <RouteLink route={{ lang, page: "appointment" }} navigate={navigate} className="button button-primary">{t.home.primary}</RouteLink>
            <a className="text-link" href="#visit-process">{t.home.secondary}<span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <figure className="hero-visual">
          <img
            src={photoUrl(photos.hero, 1500)}
            alt={t.home.heroAlt}
            width="1500"
            height="1150"
            fetchPriority="high"
          />
          <figcaption>{t.home.imageNote}</figcaption>
        </figure>
      </section>

      <section className="landing-proof-strip page-width" aria-label={lang === "ar" ? "معلومات عن العيادة" : "Clinic information"}>
        <div>
          <span>{lang === "ar" ? "نوع المشروع" : "Project type"}</span>
          <strong>{clinic.city[lang]}</strong>
        </div>
        <div>
          <span>{lang === "ar" ? "البيانات الواقعية" : "Real-world details"}</span>
          <strong>{clinic.hours[lang]}</strong>
        </div>
        <div>
          <span>{lang === "ar" ? "المحتوى" : "Content"}</span>
          <strong>{t.home.valueOne}</strong>
        </div>
      </section>

      <section className="services-section section-pad page-width" id="services">
        <SectionHeading title={t.home.servicesTitle} body={t.home.servicesBody} />
        <div className="services-feature-grid">
          {featuredServices.map((service, index) => (
            <ServiceTile key={service.slug} service={service} lang={lang} navigate={navigate} variant={index} />
          ))}
        </div>
        <RouteLink route={{ lang, page: "services" }} navigate={navigate} className="text-link section-link">{t.common.allServices}<span aria-hidden="true">↗</span></RouteLink>
      </section>

      <section className="team-section section-pad">
        <div className="page-width">
          <SectionHeading title={t.home.teamTitle} body={t.home.teamBody} />
          <div className="doctor-grid">
            {featuredDoctors.map((doctor) => <DoctorTile key={doctor.slug} doctor={doctor} lang={lang} navigate={navigate} />)}
          </div>
          <p className="image-disclosure">{t.common.imageDisclosure}</p>
          <RouteLink route={{ lang, page: "doctors" }} navigate={navigate} className="text-link section-link">{t.common.allDoctors}<span aria-hidden="true">↗</span></RouteLink>
        </div>
      </section>

      <section className="approach-section section-pad page-width">
        <div className="approach-visual">
          <img src={photoUrl(photos.rooms[1].image, 1000)} alt={photos.rooms[1].alt[lang]} width="1000" height="1200" loading="lazy" />
          <p>{t.common.imageDisclosure}</p>
        </div>
        <div className="approach-copy">
          <h2>{t.home.approachTitle}</h2>
          <p>{t.home.approachBody}</p>
          <RouteLink route={{ lang, page: "about" }} navigate={navigate} className="text-link">{t.home.approachLink}<span aria-hidden="true">↗</span></RouteLink>
        </div>
      </section>

      <section className="process-section section-pad page-width" id="visit-process">
        <SectionHeading title={t.home.processTitle} body={t.home.processBody} />
        <div className="process-grid">
          {t.home.process.map((item) => (
            <article className="process-item" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
        <RouteLink route={{ lang, page: "appointment" }} navigate={navigate} className="button button-primary process-cta">{t.home.primary}</RouteLink>
      </section>

      <FaqSection lang={lang} />
      <ContactBand lang={lang} navigate={navigate} />
    </>
  );
}

function ServiceTile({ service, lang, navigate, variant = 0 }: { service: Service; lang: Language; navigate: (path: string) => void; variant?: number }) {
  return (
    <article className={`service-tile service-tile-${variant + 1}`}>
      {variant < 2 && <img src={photoUrl(service.image, 900)} alt={service.imageAlt[lang]} width="900" height="650" loading="lazy" />}
      <div className="service-tile-content">
        <h3>{service.title[lang]}</h3>
        <p>{service.short[lang]}</p>
        <RouteLink route={{ lang, page: "service", slug: service.slug }} navigate={navigate} className="text-link">
          {copy[lang].common.readMore}<span aria-hidden="true">↗</span>
        </RouteLink>
      </div>
    </article>
  );
}

function DoctorTile({ doctor, lang, navigate }: { doctor: Doctor; lang: Language; navigate: (path: string) => void }) {
  return (
    <article className="doctor-tile">
      <RouteLink route={{ lang, page: "doctor", slug: doctor.slug }} navigate={navigate} className="doctor-photo-link" ariaLabel={`${copy[lang].common.readMore}: ${doctor.name[lang]}`}>
        <img src={photoUrl(doctor.image, 800)} alt={doctor.imageAlt[lang]} width="800" height="960" loading="lazy" />
        <span className="doctor-image-arrow" aria-hidden="true">↗</span>
      </RouteLink>
      <div className="doctor-tile-caption">
        <div><h3>{doctor.name[lang]}</h3><p>{doctor.specialty[lang]}</p></div>
      </div>
    </article>
  );
}

function PhotoGallery({ lang }: { lang: Language }) {
  return (
    <div className="photo-gallery">
      {photos.rooms.map((item, index) => (
        <figure className={`gallery-image gallery-image-${index + 1}`} key={item.id}>
          <img src={photoUrl(item.image, index === 0 ? 1200 : 850)} alt={item.alt[lang]} width={index === 0 ? "1200" : "850"} height={index === 0 ? "900" : "1050"} loading="lazy" />
          <figcaption>{item.title[lang]}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function AboutPage({ lang, navigate }: { lang: Language; navigate: (path: string) => void }) {
  const t = copy[lang];
  return (
    <PageIntro title={t.about.title} body={t.about.intro} lang={lang}>
      <section className="about-story page-width section-pad">
        <div className="about-story-image">
          <img src={photoUrl(photos.rooms[0].image, 1300)} alt={photos.rooms[0].alt[lang]} width="1300" height="1000" />
          <span>{t.about.disclaimer}</span>
        </div>
        <div className="about-story-copy">
          <h2>{t.about.storyTitle}</h2>
          <p>{t.about.storyBody}</p>
          <h2>{t.about.approachTitle}</h2>
          <p>{t.home.approachBody}</p>
        </div>
      </section>
      <section className="values-section section-pad">
        <div className="page-width">
          <SectionHeading title={lang === "ar" ? "قيم بسيطة، ومهمة." : "Simple principles, thoughtfully applied."} />
          <div className="values-grid">
            {t.about.values.map((value, index) => (
              <article className={`value-item value-item-${index + 1}`} key={value.title}>
                <h3>{value.title}</h3>
                <p>{value.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="about-gallery section-pad page-width">
        <SectionHeading title={t.about.galleryTitle} body={t.about.disclaimer} />
        <PhotoGallery lang={lang} />
      </section>
      <ContactBand lang={lang} navigate={navigate} />
    </PageIntro>
  );
}

function PageIntro({ title, body, children, lang }: { title: string; body: string; children: ReactNode; lang: Language }) {
  return (
    <>
      <section className="page-intro page-width">
        <p className="page-intro-city">{clinic.city[lang]}</p>
        <h1>{title}</h1>
        <p>{body}</p>
      </section>
      {children}
    </>
  );
}

function ServicesPage({ lang, navigate }: { lang: Language; navigate: (path: string) => void }) {
  const t = copy[lang];
  const [category, setCategory] = useState<"all" | Service["category"]>("all");
  const filtered = category === "all" ? services : services.filter((service) => service.category === category);
  const categories: ("all" | Service["category"])[] = ["all", "general", "cosmetic", "restorative", "surgical"];
  return (
    <PageIntro title={t.services.title} body={t.services.intro} lang={lang}>
      <section className="service-directory page-width section-pad">
        <div className="filter-toolbar" role="group" aria-label={t.services.filterLabel}>
          {categories.map((item) => (
            <button key={item} type="button" className={`filter-button${category === item ? " is-selected" : ""}`} aria-pressed={category === item} onClick={() => setCategory(item)}>
              {t.services.categories[item]}
            </button>
          ))}
        </div>
        <div className="services-feature-grid directory-grid">
          {filtered.map((service, index) => <ServiceTile key={service.slug} service={service} lang={lang} navigate={navigate} variant={index % 4} />)}
        </div>
        <p className="medical-disclaimer">{t.services.detailNote}</p>
      </section>
      <ContactBand lang={lang} navigate={navigate} />
    </PageIntro>
  );
}

function ServicePage({ lang, slug, navigate }: { lang: Language; slug?: string; navigate: (path: string) => void }) {
  const t = copy[lang];
  const service = services.find((item) => item.slug === slug);
  if (!service) return <NotFound lang={lang} navigate={navigate} message={t.services.notFound} />;
  const relatedDoctors = doctors.filter((doctor) => doctor.serviceSlugs.includes(service.slug));
  return (
    <>
      <section className="detail-hero page-width">
        <div className="detail-copy">
          <p className="page-intro-city">{t.common.serviceLabel}</p>
          <h1>{service.title[lang]}</h1>
          <p>{service.short[lang]}</p>
          <RouteLink route={{ lang, page: "appointment" }} navigate={navigate} className="button button-primary">{t.nav.appointment}</RouteLink>
        </div>
        <figure className="detail-photo">
          <img src={photoUrl(service.image, 1350)} alt={service.imageAlt[lang]} width="1350" height="1050" />
          <figcaption>{t.common.imageDisclosure}</figcaption>
        </figure>
      </section>
      <section className="service-detail-copy section-pad page-width">
        <div>
          <SectionHeading title={t.services.detailTitle} />
          <p className="detail-body">{service.detail[lang]}</p>
          <p className="medical-disclaimer">{t.services.detailNote}</p>
        </div>
        {relatedDoctors.length > 0 && (
          <div className="related-doctors">
            <h2>{t.doctors.title}</h2>
            {relatedDoctors.map((doctor) => <DoctorTile key={doctor.slug} doctor={doctor} lang={lang} navigate={navigate} />)}
          </div>
        )}
      </section>
      <ContactBand lang={lang} navigate={navigate} />
    </>
  );
}

function DoctorsPage({ lang, navigate }: { lang: Language; navigate: (path: string) => void }) {
  const t = copy[lang];
  return (
    <PageIntro title={t.doctors.title} body={t.doctors.intro} lang={lang}>
      <section className="doctor-directory page-width section-pad">
        <div className="doctor-grid">
          {doctors.map((doctor) => <DoctorTile key={doctor.slug} doctor={doctor} lang={lang} navigate={navigate} />)}
        </div>
        <p className="image-disclosure">{t.common.imageDisclosure}</p>
      </section>
      <ContactBand lang={lang} navigate={navigate} />
    </PageIntro>
  );
}

function DoctorPage({ lang, slug, navigate }: { lang: Language; slug?: string; navigate: (path: string) => void }) {
  const t = copy[lang];
  const doctor = doctors.find((item) => item.slug === slug);
  if (!doctor) return <NotFound lang={lang} navigate={navigate} message={t.doctors.notFound} />;
  const relatedServices = services.filter((service) => doctor.serviceSlugs.includes(service.slug));
  return (
    <>
      <section className="doctor-profile page-width">
        <figure className="doctor-profile-photo">
          <img src={photoUrl(doctor.image, 1100)} alt={doctor.imageAlt[lang]} width="1100" height="1300" />
          <figcaption>{t.common.imageDisclosure}</figcaption>
        </figure>
        <div className="doctor-profile-copy">
          <p className="page-intro-city">{doctor.specialty[lang]}</p>
          <h1>{doctor.name[lang]}</h1>
          <p className="demo-profile-note">{t.doctors.profileNote}</p>
          <h2>{t.doctors.biography}</h2>
          <p>{doctor.bio[lang]}</p>
          <h2>{t.doctors.qualifications}</h2>
          {doctor.qualifications.length > 0
            ? <ul>{doctor.qualifications.map((item, index) => <li key={`${doctor.slug}-qualification-${index}`}>{item[lang]}</li>)}</ul>
            : <p>{t.doctors.qualificationsEmpty}</p>}
          <RouteLink route={{ lang, page: "appointment" }} navigate={navigate} className="button button-primary doctor-appointment">{t.nav.appointment}</RouteLink>
        </div>
      </section>
      <section className="related-services section-pad page-width">
        <SectionHeading title={t.doctors.services} />
        <div className="related-service-list">
          {relatedServices.map((service) => (
            <RouteLink key={service.slug} route={{ lang, page: "service", slug: service.slug }} navigate={navigate} className="related-service">
              <span>{service.title[lang]}</span><span aria-hidden="true">↗</span>
            </RouteLink>
          ))}
        </div>
      </section>
      <ContactBand lang={lang} navigate={navigate} />
    </>
  );
}

function AppointmentPage({ lang }: { lang: Language }) {
  const t = copy[lang];
  const [values, setValues] = useState({ name: "", phone: "", service: "", day: "", time: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const updateValue = (field: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: "" }));
    setStatus(null);
  };

  const submitRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!values.name.trim()) nextErrors.name = t.appointment.errors.name;
    const phone = normalizePhoneDigits(values.phone).trim();
    const phoneDigits = phone.replace(/\D/g, "");
    if (!/^[+0-9()\-\s]{7,20}$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      nextErrors.phone = t.appointment.errors.phone;
    }
    if (!values.service) nextErrors.service = t.appointment.errors.service;
    if (!values.day || values.day < localToday) nextErrors.day = t.appointment.errors.day;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStatus(null);
      return;
    }

    setStatus({ kind: "success", message: t.appointment.success });
  };

  return (
    <PageIntro title={t.appointment.title} body={t.appointment.intro} lang={lang}>
      <section className="appointment-section page-width section-pad">
        <form className="appointment-form" onSubmit={submitRequest} noValidate>
          <div className="form-grid">
            <Field label={t.appointment.name} error={errors.name} id="appointment-name">
              <input id="appointment-name" name="name" autoComplete="name" value={values.name} onChange={(event) => updateValue("name", event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "appointment-name-error" : undefined} required />
            </Field>
            <Field label={t.appointment.phone} error={errors.phone} id="appointment-phone">
              <input id="appointment-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={(event) => updateValue("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "appointment-phone-error" : undefined} required />
            </Field>
            <Field label={t.appointment.service} error={errors.service} id="appointment-service">
              <select id="appointment-service" name="service" value={values.service} onChange={(event) => updateValue("service", event.target.value)} aria-invalid={Boolean(errors.service)} aria-describedby={errors.service ? "appointment-service-error" : undefined} required>
                <option value="">{t.appointment.chooseService}</option>
                {services.map((service) => <option key={service.slug} value={service.slug}>{service.title[lang]}</option>)}
              </select>
            </Field>
            <Field label={t.appointment.day} error={errors.day} id="appointment-day">
              <input id="appointment-day" name="day" type="date" min={localToday} value={values.day} onChange={(event) => updateValue("day", event.target.value)} aria-invalid={Boolean(errors.day)} aria-describedby={errors.day ? "appointment-day-error" : undefined} required />
            </Field>
            <Field label={t.appointment.time} id="appointment-time">
              <select id="appointment-time" name="time" value={values.time} onChange={(event) => updateValue("time", event.target.value)}>
                {t.appointment.timeOptions.map((option, index) => <option key={option} value={index === 0 ? "" : option}>{option}</option>)}
              </select>
            </Field>
            <Field label={t.appointment.note} id="appointment-note" hint={t.appointment.noteHint} className="field-full">
              <textarea id="appointment-note" name="note" rows={3} maxLength={180} value={values.note} onChange={(event) => updateValue("note", event.target.value)} aria-describedby="appointment-note-hint" />
            </Field>
          </div>
          <p className="form-disclaimer">{t.appointment.disclaimer}</p>
          <button type="submit" className="button button-primary form-submit">{t.appointment.submit}</button>
          <p className="form-privacy">{t.appointment.privacy}</p>
          {status && <p className={`form-status ${status.kind}`} role="status">{status.message}</p>}
        </form>
        <aside className="appointment-aside">
          <div className="aside-rule" />
          <p>{lang === "ar" ? "معلومات مهمة" : "Before you send"}</p>
          <h2>{lang === "ar" ? "طلبك للتواصل فقط." : "A request starts a conversation."}</h2>
          <span>{t.appointment.disclaimer}</span>
          <span>{t.appointment.noteHint}</span>
        </aside>
      </section>
    </PageIntro>
  );
}

function Field({ label, error, id, hint, className = "", children }: { label: string; error?: string; id: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`form-field ${className}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small className="field-error" id={`${id}-error`}>{error}</small>}
    </div>
  );
}

function ContactPage({ lang, navigate }: { lang: Language; navigate: (path: string) => void }) {
  const t = copy[lang];
  const [contactStatus, setContactStatus] = useState("");
  return (
    <PageIntro title={t.contact.title} body={t.contact.intro} lang={lang}>
      <section className="contact-page-section page-width section-pad">
        <div className="contact-details-grid">
          <article className="contact-detail">
            <span>{t.contact.address}</span>
            <h2>{t.contact.addressMissing}</h2>
          </article>
          <article className="contact-detail">
            <span>{t.contact.hours}</span>
            <h2>{clinic.hours[lang]}</h2>
            <p>{t.contact.contactMissing}</p>
          </article>
          <article className="contact-detail">
            <span>{t.contact.whatsapp}</span>
            <h2>{t.contact.contactMissing}</h2>
            <button type="button" className="button button-primary" onClick={() => setContactStatus(t.contact.demoContactStatus)}>{t.contact.whatsapp}</button>
          </article>
          <article className="contact-detail">
            <span>{t.contact.phone}</span>
            <h2>{t.contact.contactMissing}</h2>
            <button type="button" className="button button-primary" onClick={() => setContactStatus(t.contact.demoContactStatus)}>{t.contact.phone}</button>
          </article>
        </div>
        {contactStatus && <p className="contact-missing-note" role="status">{contactStatus}</p>}
        <p className="contact-missing-note">{t.common.demoNotice}</p>
        <RouteLink route={{ lang, page: "appointment" }} navigate={navigate} className="button button-primary">{t.contact.requestLink}</RouteLink>
      </section>
      <section className="contact-hours-note section-pad">
        <div className="page-width">
          <SectionHeading title={lang === "ar" ? "قبل الزيارة" : "Before your visit"} body={t.appointment.disclaimer} />
        </div>
      </section>
    </PageIntro>
  );
}

function PrivacyPage({ lang, navigate }: { lang: Language; navigate: (path: string) => void }) {
  const t = copy[lang];
  return (
    <PageIntro title={t.privacy.title} body={t.privacy.intro} lang={lang}>
      <section className="privacy-section page-width section-pad">
        <div className="privacy-list">
          {t.privacy.sections.map((item) => (
            <article className="privacy-item" key={item.title}>
              <div><h2>{item.title}</h2><p>{item.body}</p></div>
            </article>
          ))}
        </div>
        <RouteLink route={{ lang, page: "appointment" }} navigate={navigate} className="button button-primary">{t.nav.appointment}</RouteLink>
      </section>
    </PageIntro>
  );
}

function FaqSection({ lang }: { lang: Language }) {
  const t = copy[lang];
  return (
    <section className="faq-section section-pad page-width">
      <SectionHeading title={t.home.faqTitle} />
      <div className="faq-list">
        {t.home.faqs.map((faq, index) => (
          <details className="faq-item" key={faq.q} open={index === 0}>
            <summary><span>{faq.q}</span><span className="faq-symbol" aria-hidden="true" /></summary>
            <p>{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ContactBand({ lang, navigate }: { lang: Language; navigate: (path: string) => void }) {
  const t = copy[lang];
  return (
    <section className="contact-band">
      <div className="page-width contact-band-inner">
        <div><h2>{t.home.contactTitle}</h2><p>{t.home.contactBody}</p></div>
        <RouteLink route={{ lang, page: "contact" }} navigate={navigate} className="button button-light">{t.nav.contact}</RouteLink>
      </div>
    </section>
  );
}

function NotFound({ lang, navigate, message }: { lang: Language; navigate: (path: string) => void; message?: string }) {
  const t = copy[lang];
  return (
    <section className="not-found page-width">
      <p className="page-intro-city">{clinic.city[lang]}</p>
      <h1>{message ?? t.common.notFoundTitle}</h1>
      <p>{t.common.notFoundBody}</p>
      <RouteLink route={{ lang, page: "home" }} navigate={navigate} className="button button-primary">{t.common.backHome}</RouteLink>
    </section>
  );
}

function Footer({ lang, navigate }: { lang: Language; navigate: (path: string) => void }) {
  const t = copy[lang];
  const footerLinks: { page: Page; label: string }[] = [
    { page: "about", label: t.nav.about },
    { page: "services", label: t.nav.services },
    { page: "doctors", label: t.nav.doctors },
    { page: "contact", label: t.nav.contact },
    { page: "privacy", label: lang === "ar" ? "الخصوصية" : "Privacy" },
  ];
  return (
    <footer className="site-footer">
      <div className="page-width footer-main">
        <div className="footer-brand">
          <RouteLink route={{ lang, page: "home" }} navigate={navigate} className="brand">
            <span className="brand-copy brand-copy-logo"><strong>{clinic.shortName[lang]}</strong><small>{clinic.descriptor[lang]}</small></span>
          </RouteLink>
          <p>{t.common.footerDisclaimer}</p>
        </div>
        <nav className="footer-nav" aria-label={lang === "ar" ? "روابط الموقع" : "Site links"}>
          {footerLinks.map((item) => <RouteLink key={item.page} route={{ lang, page: item.page }} navigate={navigate}>{item.label}</RouteLink>)}
          <RouteLink route={{ lang, page: "appointment" }} navigate={navigate}>{t.nav.appointment}</RouteLink>
        </nav>
        <div className="footer-contact">
          <span>{clinic.city[lang]}</span>
          <span>{clinic.hours[lang]}</span>
          <span>{t.common.demoNotice}</span>
        </div>
      </div>
      <div className="page-width footer-bottom">
        <span>{t.common.demoNotice}</span>
        <span>© {new Date().getFullYear()} {clinic.name[lang]}. {t.common.copyright}</span>
        <a href="#medical-disclaimer">{lang === "ar" ? "إخلاء المسؤولية الطبية" : "Medical disclaimer"}</a>
      </div>
      <span className="sr-only" id="medical-disclaimer">{t.common.footerDisclaimer}</span>
    </footer>
  );
}

function MobileContactBar({ lang }: { lang: Language }) {
  const t = copy[lang];
  const [notice, setNotice] = useState("");
  return (
    <nav className="mobile-contact-bar" aria-label={lang === "ar" ? "التواصل السريع" : "Quick contact"}>
      <button type="button" onClick={() => setNotice(t.contact.demoContactStatus)}>{t.contact.whatsapp}</button>
      <button type="button" onClick={() => setNotice(t.contact.demoContactStatus)}>{t.contact.phone}</button>
      {notice && <span className="mobile-demo-status" role="status">{notice}</span>}
    </nav>
  );
}

export default App;
