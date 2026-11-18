import { useState, type MouseEvent, type ReactNode } from "react";
import "./home.css";
import {
  CATALOG_HASH,
  DW_ROUND_HASH,
  DWF_ROUND_HASH,
  navigate,
  SW_OVAL_HASH,
  SW_ROUND_HASH,
  SWF_HANGER_3D_HASH,
  SWF_OVAL_HASH,
  SWF_ROUND_HASH,
} from "@/lib/route";

/*
 * Homepage: the Spiral Systems website front page, shown first when the app opens (route "" / no hash).
 * A faithful port of the approved homepage mockup (live test: dbrentjones1984-droid.github.io/spiralsystems-home/),
 * styled by home.css (the mockup's CSS scoped under .hp). Differences from the static mockup, for the app:
 *  - Catalog (nav tab, Open the Product Catalog / Full Catalog, footer link, bottom bar) opens the in-app catalog
 *    home (#/catalog) instead of a new tab; the product cards open their catalog pages in the app.
 *  - Section links (Products, About, ...) scroll to the section instead of changing the hash (the hash is the route).
 * [Bracketed yellow boxes] are placeholders Brent still has to supply content for.
 */

const BASE = import.meta.env.BASE_URL;
const PHONE = "1-662-429-0373";
const TEL = "tel:16624290373";

/** In-app link to a catalog route (same tab, normal history so the phone's back button returns here). */
function AppLink({ to, className, children, ariaLabel }: { to: string; className?: string; children: ReactNode; ariaLabel?: string }) {
  return (
    <a
      href={to}
      className={className}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

const CARDS: { to: string | null; img: string | null; ph?: string; title: string; text: string; more: string }[] = [
  { to: SW_ROUND_HASH, img: "r_sw_round.webp", title: "Single Wall Round Pipe", text: "Galvanized spiral pipe with stock gauges by diameter.", more: "VIEW IN CATALOG →" },
  { to: SW_OVAL_HASH, img: "r_sw_oval.webp", title: "Single Wall Oval Pipe", text: "Flat oval spiral duct with nominal sizes and gauge chart.", more: "VIEW IN CATALOG →" },
  { to: SWF_ROUND_HASH, img: "r_sw_tee.webp", title: "Round Fittings", text: "Elbows, tees, laterals, wyes, reducers, taps, caps and more.", more: "VIEW IN CATALOG →" },
  { to: SWF_OVAL_HASH, img: "r_oval_elbow.webp", title: "Oval Fittings", text: "Oval elbows, tees, laterals, reducers, offsets and couplings.", more: "VIEW IN CATALOG →" },
  { to: DW_ROUND_HASH, img: "r_dw_round.webp", title: "Double Wall Pipe", text: "Insulated inner and outer wall pipe, solid or perforated liner.", more: "VIEW IN CATALOG →" },
  { to: DWF_ROUND_HASH, img: "r_dw_lat.webp", title: "Double Wall Fittings", text: "Double wall elbows, tees, laterals, taps and more.", more: "VIEW IN CATALOG →" },
  { to: SWF_HANGER_3D_HASH, img: "r_hanger.webp", title: "Accessories", text: "Hangers and other accessories for a complete install.", more: "VIEW IN CATALOG →" },
  { to: null, img: null, ph: "[Manifolding photo placeholder]", title: "Manifolding", text: "Manifold assemblies built to your layout.", more: "REQUEST A QUOTE →" },
  { to: null, img: null, ph: "[Custom fabrication photo placeholder]", title: "Custom Fabrication", text: "Special sizes and fittings made to your drawings.", more: "REQUEST A QUOTE →" },
];

export function HomePage() {
  const [navOpen, setNavOpen] = useState(false);

  /** Section link: scroll to the section (below the sticky header) without touching the hash route. */
  const jump = (id: string) => (e: MouseEvent) => {
    e.preventDefault();
    setNavOpen(false);
    if (id === "home") window.scrollTo({ top: 0, behavior: "smooth" });
    else document.getElementById(`hp-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const Jump = ({ id, className, children }: { id: string; className?: string; children: ReactNode }) => (
    <a href={`#${id}`} className={className} onClick={jump(id)}>
      {children}
    </a>
  );

  return (
    <div className="hp">
      {/* 1. Top utility bar */}
      <div className="topbar">
        <div className="wrap topbar-in">
          <span className="tb-loc">Nesbit, MS &nbsp;•&nbsp; Nashville, TN</span>
          <span className="tb-right">
            <a href={TEL}>Phone {PHONE}</a>
          </span>
        </div>
      </div>

      {/* 2. Header / nav */}
      <header className="header">
        <div className="wrap header-in">
          <Jump id="home" className="brand">
            <img src={`${BASE}splash-mark.webp`} alt="Spiral Systems Incorporated" width={720} height={358} />
          </Jump>
          <input type="checkbox" id="navtoggle" hidden checked={navOpen} onChange={(e) => setNavOpen(e.target.checked)} />
          <nav className="nav">
            <Jump id="home" className="active">Home</Jump>
            <Jump id="products">Products</Jump>
            <Jump id="about">About</Jump>
            <Jump id="submittals">Submittals</Jump>
            <Jump id="contact">Contact</Jump>
            <AppLink to={CATALOG_HASH} className="nav-catalog">
              Catalog
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </AppLink>
          </nav>
          <div className="callnow">
            <small>CALL NOW</small>
            <a href={TEL}>{PHONE}</a>
          </div>
          <AppLink to={CATALOG_HASH} className="m-catalog">Catalog</AppLink>
          <label htmlFor="navtoggle" className="burger" aria-label="Menu">
            <span></span>
            <span></span>
            <span></span>
          </label>
        </div>
      </header>

      {/* 3. Hero (load-screen look) */}
      <section className="hero" id="hp-home">
        <div className="hero-frame">
          <div className="banner">
            <h1>SPIRAL DUCT PRODUCTS</h1>
          </div>
          <p className="lines">ROUND • OVAL • FITTINGS • ACCESSORIES • CUSTOM FABRICATION</p>
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <h2>
                Spiral Pipe &amp; Fittings, <span>Single &amp; Double Wall</span>
              </h2>
              <p className="tag">
                Quality Spiral Duct Products
                <br />
                for Commercial, Industrial and Custom Applications
              </p>
              <p className="hero-p">
                Round and oval spiral pipe, fittings, double wall duct, manifolding, accessories and custom fabrication, from our locations in Nesbit, Mississippi
                and Nashville, Tennessee.
              </p>
              <div className="btns">
                <AppLink to={CATALOG_HASH} className="btn btn-primary">Open the Product Catalog</AppLink>
                <Jump id="contact" className="btn btn-ghost">Request a Quote</Jump>
              </div>
            </div>
            <div className="hero-photo">
              <img src={`${BASE}splash-photo.webp`} alt="Galvanized spiral pipe, elbow, reducer and tee" width={1080} height={716} />
            </div>
          </div>
          <div className="addr-row">
            <p>
              860 Old Hwy 51 North
              <br />
              Nesbit, MS 38651
            </p>
            <i></i>
            <p>
              399 Old Hickory Blvd
              <br />
              Old Hickory, TN 37138
            </p>
            <i></i>
            <p>
              Phone
              <br />
              {PHONE}
            </p>
          </div>
        </div>
      </section>

      {/* 4. About */}
      <section className="about" id="hp-about">
        <div className="wrap about-grid">
          <div>
            <p className="eyebrow">ABOUT US</p>
            <h2 className="h2">Spiral Systems Incorporated</h2>
            <p>
              Spiral Systems manufactures spiral ductwork for commercial, industrial and custom applications: single wall and double wall round and oval pipe, a
              full line of fittings, manifolding, accessories and custom fabrication.
            </p>
            <p>We serve customers from two locations: our main office in Nesbit, Mississippi, and our Nashville-area shop in Old Hickory, Tennessee.</p>
            <p className="ph">[About story placeholder: company history, years in business, shop capabilities and equipment. Brent to supply.]</p>
            <Jump id="contact" className="btn btn-primary">Learn More</Jump>
          </div>
          <div className="about-media">
            <div className="am-big">
              <img src={`${BASE}home/img/r_oval_elbow.webp`} alt="Oval gored elbow (3D model from the catalog)" />
            </div>
            <div className="am-small">
              <img src={`${BASE}splash-mark.webp`} alt="Spiral Systems logo" />
            </div>
          </div>
        </div>
      </section>

      {/* 5. Products grid */}
      <section className="products" id="hp-products">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">OUR PRODUCTS</p>
              <h2 className="h2">
                Spiral Pipe, Fittings
                <br />
                &amp; Accessories
              </h2>
            </div>
            <p className="sec-intro">Every product line below is in our online catalog, with spec sheets and interactive 3D models you can open right on your phone.</p>
          </div>
          <div className="cards">
            {CARDS.map((c) => {
              const inner = (
                <>
                  {c.img ? (
                    <div className="card-img">
                      <img src={`${BASE}home/img/${c.img}`} alt="" />
                    </div>
                  ) : (
                    <div className="card-img card-ph">
                      <span>{c.ph}</span>
                    </div>
                  )}
                  <h3>{c.title}</h3>
                  <p>{c.text}</p>
                  <span className="more">{c.more}</span>
                </>
              );
              return c.to ? (
                <AppLink key={c.title} to={c.to} className="card">
                  {inner}
                </AppLink>
              ) : (
                <Jump key={c.title} id="contact" className="card">
                  {inner}
                </Jump>
              );
            })}
          </div>
          <div className="center">
            <AppLink to={CATALOG_HASH} className="btn btn-primary btn-lg">Open the Full Catalog</AppLink>
          </div>
        </div>
      </section>

      {/* 6. Testimonials (placeholder) */}
      <section className="reviews">
        <div className="wrap">
          <p className="eyebrow center-t">WHAT CUSTOMERS SAY</p>
          <h2 className="h2 center-t">Customer Testimonials</h2>
          <div className="rev-grid">
            {[0, 1, 2].map((i) => (
              <div className="rev" key={i}>
                <p className="q">“[Testimonial placeholder: quote from a contractor or customer.]”</p>
                <p className="who">[Name, Company]</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Facts band */}
      <section className="facts">
        <div className="wrap facts-grid">
          <div>
            <b>2</b>
            <span>Locations: Nesbit, MS &amp; Nashville, TN</span>
          </div>
          <div>
            <b>Single &amp; Double</b>
            <span>Wall Pipe and Fittings</span>
          </div>
          <div>
            <b>Round &amp; Oval</b>
            <span>Spiral Duct Profiles</span>
          </div>
          <div>
            <b>3D</b>
            <span>Interactive Catalog Models</span>
          </div>
        </div>
      </section>

      {/* 8. Quote form + contact */}
      <section className="contact" id="hp-contact">
        <div className="wrap contact-grid">
          <div className="quote-wrap">
            <div className="quote-bg"></div>
            {/* Mockup only: the form does not send anything yet. */}
            <form className="quote" onSubmit={(e) => e.preventDefault()}>
              <h3>REQUEST A QUOTE</h3>
              <div className="row2">
                <input placeholder="Name" />
                <input placeholder="Company" />
              </div>
              <div className="row2">
                <input placeholder="Phone" />
                <input placeholder="Email" />
              </div>
              <input placeholder="Job name / location" />
              <select defaultValue="Product type">
                {["Product type", "Single wall round", "Single wall oval", "Double wall round", "Double wall oval", "Fittings", "Manifolding", "Accessories", "Custom fabrication"].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <textarea placeholder="Sizes, quantities, gauge, notes"></textarea>
              <label className="chk">
                <input type="checkbox" /> Include submittal sheets
              </label>
              <button type="submit">SEND REQUEST</button>
            </form>
          </div>
          <div className="contact-copy">
            <p className="eyebrow">CONTACT US</p>
            <h2 className="h2">
              Get Pricing, Submittals
              <br />
              or Help With a Job
            </h2>
            <p>Call either location, or send us your sizes and quantities and we’ll get back to you.</p>
            <ul className="checks">
              <li>Single wall &amp; double wall, round &amp; oval</li>
              <li>Submittal sheets available</li>
              <li>Custom fabrication to your drawings</li>
            </ul>
            <div className="locs">
              <div>
                <h4>Main Office · Nesbit, MS</h4>
                <p>
                  860 Old Hwy 51 North
                  <br />
                  P.O. Box 513
                  <br />
                  Nesbit, MS 38651
                </p>
              </div>
              <div>
                <h4>Nashville, TN</h4>
                <p>
                  399 Old Hickory Blvd
                  <br />
                  Old Hickory, TN 37138
                </p>
              </div>
            </div>
            <p className="phones">
              Phone <a href={TEL}>{PHONE}</a>
            </p>
            <a className="btn btn-dark" href={TEL}>
              CALL NOW
            </a>
          </div>
        </div>
      </section>

      {/* 9. Submittals + project gallery (placeholders) */}
      <section className="submittals" id="hp-submittals">
        <div className="wrap">
          <h2 className="h2 center-t">Submittal Sheets</h2>
          <div className="u-line"></div>
          <div className="sub-grid">
            {["Single Wall Round Submittal", "Double Wall Rectangular Submittal"].map((t) => (
              <div className="sub" key={t}>
                <div className="sub-ic">PDF</div>
                <div>
                  <h3>{t}</h3>
                  <p>Fillable PDF and Word template.</p>
                </div>
                <Jump id="submittals" className="btn btn-ghost sm">[Download link]</Jump>
              </div>
            ))}
          </div>
          <h2 className="h2 center-t mt">Project Gallery</h2>
          <div className="u-line"></div>
          <div className="gallery">
            {[0, 1, 2, 3].map((i) => (
              <div className="g-ph" key={i}>
                [Project photo placeholder]
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Three-feature band */}
      <section className="features">
        <div className="wrap feat-grid">
          <div className="feat">
            <svg viewBox="0 0 48 48">
              <path d="M24 4 42 14v20L24 44 6 34V14z M6 14l18 10 18-10 M24 24v20" />
            </svg>
            <h3>INTERACTIVE 3D CATALOG</h3>
            <p>Spec sheets and 3D models of our pipe and fittings, ready on any phone.</p>
          </div>
          <div className="feat">
            <svg viewBox="0 0 48 48">
              <path d="M12 4h17l9 9v31H12z M29 4v9h9 M18 24h14 M18 31h14 M18 38h9" />
            </svg>
            <h3>SUBMITTAL SHEETS</h3>
            <p>Fillable submittals for single wall round and double wall rectangular.</p>
          </div>
          <div className="feat">
            <svg viewBox="0 0 48 48">
              <path d="M24 44s14-13 14-25a14 14 0 0 0-28 0c0 12 14 25 14 25z M24 13a6 6 0 1 1 0 12 6 6 0 0 1 0-12z" />
            </svg>
            <h3>TWO LOCATIONS</h3>
            <p>Nesbit, Mississippi and Nashville, Tennessee.</p>
          </div>
        </div>
      </section>

      {/* 11. Footer */}
      <footer className="footer">
        <div className="wrap foot-grid">
          <div>
            <div className="foot-logo">
              <img src={`${BASE}splash-mark.webp`} alt="Spiral Systems Incorporated" />
            </div>
            <p className="foot-tag">Quality Spiral Duct Products for Commercial, Industrial and Custom Applications.</p>
          </div>
          <div>
            <h4>COMPANY</h4>
            <Jump id="home">Home</Jump>
            <Jump id="about">About</Jump>
            <AppLink to={CATALOG_HASH}>Catalog</AppLink>
            <Jump id="submittals">Submittals</Jump>
            <Jump id="contact">Contact</Jump>
          </div>
          <div>
            <h4>PRODUCTS</h4>
            <AppLink to={SW_ROUND_HASH}>Single Wall Round</AppLink>
            <AppLink to={SW_OVAL_HASH}>Single Wall Oval</AppLink>
            <AppLink to={DW_ROUND_HASH}>Double Wall</AppLink>
            <AppLink to={SWF_ROUND_HASH}>Fittings</AppLink>
            <Jump id="products">Manifolding</Jump>
            <AppLink to={SWF_HANGER_3D_HASH}>Accessories</AppLink>
            <Jump id="products">Custom Fabrication</Jump>
          </div>
          <div>
            <h4>CONTACT US</h4>
            <p>
              860 Old Hwy 51 North, P.O. Box 513
              <br />
              Nesbit, MS 38651
            </p>
            <p>
              399 Old Hickory Blvd
              <br />
              Old Hickory, TN 37138
            </p>
            <p>Phone {PHONE}</p>
          </div>
        </div>
        <div className="copy">© 2026 Spiral Systems Incorporated · All Rights Reserved</div>
      </footer>

      {/* Mobile sticky call bar */}
      <div className="callbar">
        <a href={TEL}>Call {PHONE}</a>
        <AppLink to={CATALOG_HASH}>Catalog</AppLink>
      </div>
    </div>
  );
}
