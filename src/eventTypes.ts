/**
 * One page for every kind of booking.
 *
 * A DJ site that describes "events" in general ranks for nothing in particular.
 * Each of these is a different buyer with a different question — a bride asking
 * about a first dance, a promoter asking about a guest headline, an office
 * manager asking whether the Christmas do can have a mic — so each gets its own
 * page, written answer-first so a search engine or an answer engine can lift the
 * opening paragraph and be right.
 *
 * The shape is the same on purpose: the answer in the first two sentences, the
 * facts in a table, the questions the buyer actually asks as headings, and a
 * short honest caveat. `scripts/build-static-pages.mts` turns each entry into
 * HTML, JSON-LD and a sitemap line.
 */
export interface EventType {
  /** Stable id, also the URL stem. */
  id: string;
  /** Page label in nav, footer and the hub. */
  nav: string;
  /** <title>, written for a person mid-search. */
  title: string;
  /** Meta description: an answer, not a keyword dump. */
  description: string;
  eyebrow: string;
  h1: string;
  /** The 40–60 word answer, quoted by answer engines almost verbatim. */
  answer: string;
  /** Short, checkable facts. Rendered as a table and summarised in the answer. */
  facts: { label: string; value: string }[];
  /** Question-shaped headings with a self-contained answer under each. */
  sections: { q: string; a: string; points?: string[] }[];
  /** The questions people actually type, with answers that stand alone. */
  faqs: { q: string; a: string }[];
  /** What the night looks like, in the order it happens. */
  running?: string[];
  /** Schema price fields. */
  from: string;
  fromLabel: string;
}

export const EVENT_TYPES: EventType[] = [
  {
    id: 'birthday-party-dj',
    nav: 'Birthdays & parties',
    title: 'Birthday party DJ in Manchester & the North West — from £650 · DJ KC',
    description:
      'Birthday and private party DJ for Manchester, Liverpool and the North West, from £650. House, disco and the anthems your crowd grew up on, a mic for speeches, live vocals optional.',
    eyebrow: 'Birthdays & private parties',
    h1: 'A birthday party DJ who plays the room, not a playlist',
    answer:
      'DJ KC plays birthday parties and private parties across Manchester, Liverpool and the North West from £650 for two hours. Sets move from soul and disco while people arrive to house and the songs your crowd grew up on, with a wired mic for speeches and optional live vocals.',
    facts: [
      { label: 'From', value: '£650 for two hours' },
      { label: 'Also quoted', value: 'Signature Live from £1,100 with live vocals' },
      { label: 'Travel', value: 'Included across the North West' },
      { label: 'Kit', value: 'Sound, dance-floor lighting and a mic for speeches' },
      { label: 'Notice', value: '2–6 weeks typical; short notice often possible' },
      { label: 'Deposit', value: '50% holds the date, balance before the party' },
    ],
    sections: [
      {
        q: 'What does a birthday party DJ cost?',
        a: 'UK birthday and party DJs typically charge £300–£700 for an evening. DJ KC starts at £650 for a two-hour set, £1,100 with live vocals, with travel included across the North West — so a Manchester or Liverpool booking carries no mileage on top.',
        points: [
          '£650 — Club Night: two hours, sound and lighting, pre-party call',
          '£1,100 — Signature Live: three hours plus live vocals on her own records',
          'Quoted in 24 hours — all-day parties, marquees, two rooms, extra hours',
        ],
      },
      {
        q: 'Can you play requests and the songs we actually want?',
        a: 'Yes, and it is the point. You send must-plays and never-plays in advance; KC builds the arc from them and reads the floor on the night. Requests are taken at the decks where they fit, and embarrassing ones are politely ignored.',
      },
      {
        q: 'What ages and crowds do you play to?',
        a: 'Everything from a 21st in a bar to a 60th in a garden marquee. A mixed-age party gets a wider set: Motown, disco and indie singalongs early, house and dance anthems once the room has had a drink. A younger room goes straight to house and garage.',
      },
      {
        q: 'Do you bring sound and lighting?',
        a: 'Yes. The quoted fee includes a PA sized to the room, dance-floor lighting and a wired SM58 for speeches and toasts. Venues with their own rig are fine too — KC can play on house CDJs and will confirm what is there before the day.',
      },
      {
        q: 'Can you sing at a birthday party?',
        a: 'Yes — that is the Signature Live package. Mid-set KC steps off the decks and sings live over her own productions with her own mic and in-ear monitoring. It is optional, it lands best around the last hour, and it is the bit your guests film.',
      },
      {
        q: 'How far do you travel for a party?',
        a: 'Manchester, Salford, Stockport, Bolton, Bury, Rochdale, Oldham, Wigan, Warrington, Liverpool, Preston, Blackpool, Chester and the wider Lancashire and Cheshire area are all inside the included travel. Leeds, Sheffield, Birmingham, London, Ireland and Europe are quoted with travel at cost.',
      },
    ],
    faqs: [
      {
        q: 'How much does a birthday party DJ cost in Manchester?',
        a: 'Manchester party DJs commonly charge £300–£600 for a house party or bar booking and £450–£900 for a full function. DJ KC charges from £650 for a two-hour set with sound, lighting and a mic, travel included across the North West, and from £1,100 with live vocals.',
      },
      {
        q: 'How long should the DJ play at a birthday party?',
        a: 'Three to four hours covers most parties: an hour of background music as guests arrive, two hours of dancing, then the last half hour of anthems. KC quotes two hours as standard and adds hours at a fixed rate rather than by the surprise.',
      },
      {
        q: 'Can the DJ keep a party going with a mixed-age crowd?',
        a: 'Yes. A mixed room needs a wider set than a club night: Motown, disco, funk and indie early, then house and dance records once the floor loosens up. KC builds that arc in advance from your must-plays and adjusts live.',
      },
      {
        q: 'Do you need a deposit for a party booking?',
        a: 'A 50% deposit holds the date, with the balance due before the party. Card payment runs through Stripe at the end of the booking form, and the one-page contract sets out the refund terms before you pay anything.',
      },
    ],
    running: [
      'Send the date, venue and rough guest count — a reply within 24 hours.',
      'Confirm the package and pay the 50% deposit; the date is held.',
      'A call two weeks out: timings, must-plays, never-plays, speeches.',
      'Setup and soundcheck before guests arrive; mic handed over for the toast.',
    ],
    from: '650',
    fromLabel: 'from £650',
  },
  {
    id: 'corporate-dj',
    nav: 'Corporate & awards',
    title: 'Corporate party DJ for awards nights and company events · DJ KC',
    description:
      'Corporate party and awards-night DJ for Manchester, Liverpool and UK-wide company events. Open-format sets to your running order, clean announcements, mic for speeches. From £650.',
    eyebrow: 'Corporate & awards nights',
    h1: 'A corporate DJ who works to your running order',
    answer:
      'DJ KC plays corporate parties, awards nights and company celebrations from £650, across Manchester, Liverpool and the UK. The set is open-format and built around your running order — announcements clean, volume right for the room, invoices and risk assessments ready before the event.',
    facts: [
      { label: 'From', value: '£650 for two hours' },
      { label: 'Typical booking', value: 'Awards night, Christmas do, launch, conference close' },
      { label: 'Paperwork', value: 'Invoice, contract, tech rider, public liability on request' },
      { label: 'Format', value: 'Open-format: soul and disco over dinner, house and anthems after' },
      { label: 'Travel', value: 'Included across the North West; UK-wide quoted at cost' },
      { label: 'Deposit', value: '50% holds the date, or pay on invoice terms' },
    ],
    sections: [
      {
        q: 'What does a corporate DJ cost?',
        a: 'UK corporate DJs typically charge £600–£2,500 depending on the room, the running order and how much of the evening is MC work. KC starts at £650 for two hours and £1,100 for three hours with live vocals, with travel included across the North West.',
        points: [
          'Awards nights: walk-up music per category, holding music, clean mic work',
          'Christmas parties: two sets either side of the meal, volume dropped for speeches',
          'Brand events and launches: production advance, stage plot, press kit',
        ],
      },
      {
        q: 'Will you work to our running order and announcements?',
        a: 'Yes. You send the order of the evening and the names; KC handles walk-ups, holding music and announcements, and keeps the volume under the speeches. Changes on the night are normal — the mic stays live and the plan bends rather than breaks.',
      },
      {
        q: 'Is the music suitable for a mixed-age company crowd?',
        a: 'Corporate rooms are the widest brief there is: 22-year-old graduates and the finance director in the same room. Sets start with soul, disco and funk that everybody knows, then move to house and current anthems once the floor has decided. Nothing embarrassing, nothing obscure.',
      },
      {
        q: 'What paperwork can you provide?',
        a: 'An invoice with VAT-ready details, a one-page contract, a tech rider the venue can sign off, and public liability insurance on request. Larger companies often need a supplier form completing — send it with the enquiry and it comes back the same week.',
      },
      {
        q: 'Do you bring equipment and can you work with venue AV?',
        a: 'Yes to both. The fee includes a PA, dance-floor lighting and a wired mic; where a venue supplies a line array and stage lighting, KC patches into it and brings only the decks and vocal rig. A tech rider confirms power, space and curfew in advance.',
      },
    ],
    faqs: [
      {
        q: 'How much does a corporate DJ cost in the UK?',
        a: 'Corporate DJs in the UK typically charge £600–£2,500. A two-hour party set is usually £600–£900; a full awards night with MC duties, walk-up music and six hours on site is £1,200–£2,500. DJ KC quotes from £650 with travel included across the North West.',
      },
      {
        q: 'Can the DJ provide a microphone for speeches and awards?',
        a: 'Yes. A wired SM58 is included for speeches, announcements and award walk-ups, soundchecked before guests arrive. Radio mics for the host can be added, and the venue is told in advance so the room is set up for it.',
      },
      {
        q: 'Do you play Christmas parties?',
        a: 'Yes — December is the busiest month of the year. Christmas parties are quoted the same way as any corporate booking, with two sets either side of the meal and volume dropped for speeches. Fridays and Saturdays go first, so ask in September.',
      },
      {
        q: 'Can you invoice our company and work with our finance team?',
        a: 'Yes. Invoices carry the company details and a purchase order number if you have one. Payment is by card through Stripe or by bank transfer on invoice terms, and a 50% deposit holds the date.',
      },
    ],
    running: [
      'Send the date, venue, running order and any supplier forms.',
      'A quote and tech rider back within 24 hours; the deposit holds the date.',
      'A production call with the venue: power, space, curfew, walk-ups.',
      'Setup and soundcheck before guests arrive; mic live for the speeches.',
    ],
    from: '650',
    fromLabel: 'from £650',
  },
  {
    id: 'christmas-party-dj',
    nav: 'Christmas parties',
    title: 'Christmas party DJ in Manchester & the North West — book early · DJ KC',
    description:
      'Christmas party DJ for Manchester, Liverpool and the North West: soul and disco through the meal, the festive records people want, a mic for the speeches. From £650.',
    eyebrow: 'Christmas parties',
    h1: 'A Christmas party DJ who knows the December brief',
    answer:
      'DJ KC plays Christmas parties across Manchester, Liverpool and the North West from £650. Expect soul and disco through the meal, the Christmas records people actually want, then house and party anthems until the last taxi — with a mic for speeches and the raffle.',
    facts: [
      { label: 'From', value: '£650 for two hours' },
      { label: 'Peak dates', value: 'Fridays and Saturdays in December' },
      { label: 'Books by', value: 'September for a Friday or Saturday' },
      { label: 'Format', value: 'Two sets either side of the meal, volume dropped for speeches' },
      { label: 'Travel', value: 'Included across the North West' },
      { label: 'Deposit', value: '50% holds the date' },
    ],
    sections: [
      {
        q: 'When should we book a Christmas party DJ?',
        a: 'September. December Fridays and Saturdays are gone first, and the last two weekends of the month are usually committed by October. Midweek December dates stay open longer and often cost less — a Thursday works better than people expect.',
      },
      {
        q: 'What do you play at a Christmas party?',
        a: 'It depends whose party it is. Office parties get disco, funk and Motown through the meal, the Christmas records everybody secretly wants at the right moment, then house and current anthems. Younger rooms get more house; older rooms get more soul.',
      },
      {
        q: 'Can you handle the speeches, raffle and awards?',
        a: 'Yes. The mic is live throughout and KC announces the raffle, the awards and the taxis home, keeps the volume down while anyone is talking, and picks the walk-up music. It is the part nobody notices when it is done properly.',
      },
      {
        q: 'Do you play Christmas songs?',
        a: 'Yes — in the right dose. Two or three at the peak, not a continuous festive playlist. Mariah, Slade, Wizzard and the Pogues land once the room is warm; earlier than that they empty the floor. KC reads when the room is ready for them.',
      },
      {
        q: 'What is included in the price?',
        a: 'Two hours of DJing, a PA sized to the room, dance-floor lighting and a wired mic, plus a pre-event call to agree timings, must-plays and the running order. Extra hours are quoted at a fixed rate, not added as a surprise on the night.',
      },
    ],
    faqs: [
      {
        q: 'How much does a Christmas party DJ cost?',
        a: 'UK Christmas party DJs typically charge £500–£1,200 for an evening, with December Friday and Saturday dates at the top of that range. DJ KC charges from £650 for two hours with sound, lighting and a mic, travel included across the North West.',
      },
      {
        q: 'How far in advance should I book a Christmas party DJ?',
        a: 'Book September or early October for a Friday or Saturday in December. The last two weekends are usually gone by then. Midweek dates and early December stay available longer and are often cheaper.',
      },
      {
        q: 'Can you play for a company Christmas party with a meal?',
        a: 'Yes. A typical booking is background sets through the meal at low volume, the speeches and raffle handled on the mic, then two hours of dancing once the tables are cleared. The running order is agreed in advance and adjusted live.',
      },
      {
        q: 'Do you bring a microphone for speeches?',
        a: 'Yes — a wired SM58 is included for speeches, the raffle and awards. It is soundchecked before guests sit down, and the volume is dropped so the room can hear the person speaking rather than the music.',
      },
    ],
    running: [
      'Enquire in September with the date, venue and headcount.',
      'Deposit holds the date; the running order follows in November.',
      'A call to agree the meal timings, the speeches and the last song.',
      'Setup before guests arrive; mic live for the speeches; two sets after.',
    ],
    from: '650',
    fromLabel: 'from £650',
  },
  {
    id: 'club-night-dj',
    nav: 'Club nights & residencies',
    title: 'Club night DJ and guest headline for UK venues — DJ KC',
    description:
      'Club night DJ for UK venues: headline or warm-up house sets, optional live vocals, tech advance and promo pack. From £650; residencies quoted in 24 hours.',
    eyebrow: 'Club nights & residencies',
    h1: 'A club DJ who builds the arc, not just the peak',
    answer:
      'DJ KC plays club nights and venue takeovers across the UK from £650 for a two-hour headline or warm-up set. House in its working forms — piano, vocal, tech and Afro — with the option of a live vocal moment at peak time, and a technical advance before every date.',
    facts: [
      { label: 'From', value: '£650 for a two-hour set' },
      { label: 'Format', value: 'Warm-up, headline or all-night-long' },
      { label: 'Live vocals', value: 'Optional at peak time, own mic and in-ear monitoring' },
      { label: 'Included', value: 'Pre-show call, tech rider, promo pack and reels' },
      { label: 'Travel', value: 'North West included; UK and Ireland quoted at cost' },
      { label: 'Residencies', value: 'Quoted per season in 24 hours' },
    ],
    sections: [
      {
        q: 'What does a club night booking include?',
        a: 'A two-hour headline or warm-up set, a pre-show call about the room and the crowd, a technical advance for the venue, and a promo pack with reels and stills for your channels two weeks before doors. Live vocals can be added to the peak.',
      },
      {
        q: 'Can you warm up as well as headline?',
        a: 'Yes, and warm-up is a craft of its own: the job is to hand over a full floor, not to empty it. Warm-up sets stay under the headline tempo, build the room gradually and leave the peak for whoever follows — or for the second half of an all-night set.',
      },
      {
        q: 'What is the live vocal moment?',
        a: 'Somewhere after the halfway point KC steps off the decks and sings live over her own productions, with her own mic and in-ear monitoring. It is the moment most crowds film. It needs the venue to have a spare channel and a monitor, and it is planned in advance.',
      },
      {
        q: 'What do you need from the venue?',
        a: 'Two CDJ-2000nxs2 or newer and a DJM-900, two quality booth monitors, and a wired SM58 for the vocal section. Where a venue has no CDJs, KC brings her own controller. A full tech rider goes out with the confirmation so nothing is guessed on the night.',
      },
      {
        q: 'Do you do residencies and takeovers?',
        a: 'Yes. Monthly or quarterly residencies are quoted per season rather than per night, and multi-room takeovers include lineup curation on request. Both are quoted within 24 hours once the venue, dates and capacity are known.',
      },
    ],
    faqs: [
      {
        q: 'How much does a club DJ cost in the UK?',
        a: 'UK club DJ fees run from about £250 for a local support slot to £1,500 or more for a guest headline, depending entirely on draw. DJ KC charges from £650 for a two-hour set with a promo pack and technical advance, with residencies quoted per season.',
      },
      {
        q: 'Do you play all night long?',
        a: 'Yes. All-night sets are quoted separately because they run four to six hours and need a longer arc: a slow build, a live vocal moment around the middle, and a peak that leaves something for the last hour.',
      },
      {
        q: 'What kit do you need in the booth?',
        a: 'Two CDJ-2000nxs2 or newer, a DJM-900, two booth monitors and a wired SM58 for the vocal section. If the venue has no CDJs, KC brings her own controller. The tech rider goes out with the confirmation.',
      },
      {
        q: 'Will you promote the night?',
        a: 'Every booking includes a promo pack — reels, stills and mix clips — delivered two weeks before doors for your channels. KC also posts the date to her own audience, which for a guest headline is usually the point of booking her.',
      },
    ],
    running: [
      'Send the date, venue, capacity, set length and slot.',
      'Quote within 24 hours; deposit holds the date.',
      'Technical advance with the venue; promo pack two weeks out.',
      'Soundcheck, then the set — with the vocal moment planned in advance.',
    ],
    from: '650',
    fromLabel: 'from £650',
  },
  {
    id: 'festival-dj',
    nav: 'Festivals & takeovers',
    title: 'Festival DJ and brand takeover sets — quoted in 24 hours · DJ KC',
    description:
      'Festival DJ sets and brand takeovers with production advance, stage plot and press kit. House and live vocal sets across the UK, Ireland and Europe. Quoted in 24 hours.',
    eyebrow: 'Festivals & brand takeovers',
    h1: 'Festival sets, brand takeovers and stage curation',
    answer:
      'DJ KC plays festival stages and brand takeovers across the UK, Ireland and Europe, quoted within 24 hours. Bookings include a production advance and stage plot, a press kit for your programme, and lineup curation on request — with the live vocal set available for the main stage.',
    facts: [
      { label: 'Quoted', value: 'Within 24 hours' },
      { label: 'Set lengths', value: '45 minutes to two hours; all-day coverage on request' },
      { label: 'Included', value: 'Production advance, stage plot, press kit, promo assets' },
      { label: 'Travel', value: 'UK and Ireland at cost; Europe and Ibiza on the same routing' },
      { label: 'Curation', value: 'Full lineup programming on request' },
      { label: 'Deposit', value: '50%, or per your production schedule' },
    ],
    sections: [
      {
        q: 'What does a festival booking include?',
        a: 'A production advance covering power, booth spec, monitors and changeover times; a stage plot; a press kit with biography, photography and rider for your programme; and promo assets for your channels. Lineup curation for a stage is available as an add-on.',
      },
      {
        q: 'How long a set do you play at a festival?',
        a: 'Forty-five minutes to two hours is the usual range, and the set is built for the slot: a short set is all peak, a long one has an arc. All-day coverage — a DJ plus live vocals across a stage — is quoted as a day rate.',
      },
      {
        q: 'Can you curate a stage or lineup?',
        a: 'Yes. KC has programmed rooms and takeovers, and will build a lineup around your budget, your audience and your headliner, with a running order that does not put two similar sets back to back. Ask for it in the enquiry and it is quoted with the fee.',
      },
      {
        q: 'Do you travel for European and Irish festivals?',
        a: 'Yes. Ireland, Ibiza and mainland Europe sit on the same routing as UK dates, using a compact, airline-friendly rig that fits baggage limits. Travel and accommodation are quoted at cost and shown separately so your production budget is clear.',
      },
      {
        q: 'What do you need from the festival production team?',
        a: 'Two CDJs and a DJM-900 at the booth, two monitors, a wired SM58 if the live vocal set is booked, and a 30-minute changeover. The production advance confirms all of it in writing before the build, and the stage plot goes to your tech team.',
      },
    ],
    faqs: [
      {
        q: 'How much does a festival DJ cost?',
        a: 'UK festival DJ fees run from a few hundred pounds for an early slot to several thousand for a headline, depending on draw and stage. DJ KC quotes festivals individually within 24 hours, with travel at cost and production requirements set out in the advance.',
      },
      {
        q: 'Can you play a live vocal set on a festival stage?',
        a: 'Yes. The Signature Live set adds live vocals over her own productions, with her own mic and in-ear monitoring. It needs an extra channel and a monitor at the booth, both confirmed in the production advance before the build.',
      },
      {
        q: 'How far ahead should a festival book?',
        a: 'Six to nine months is normal for a summer festival, and earlier for headline slots. Winter events and brand activations can often be turned around in weeks if the date is open.',
      },
      {
        q: 'Do you provide a press kit for the programme?',
        a: 'Yes. A biography, approved photography, technical rider and social handles arrive with the confirmation, formatted so your programme and website can use them without editing.',
      },
    ],
    running: [
      'Send the date, stage, slot length and budget.',
      'Quote within 24 hours; deposit confirms the slot.',
      'Production advance and stage plot to your tech team.',
      'Press kit and promo assets; soundcheck to the changeover time.',
    ],
    from: '650',
    fromLabel: 'quoted in 24 hours',
  },
  {
    id: 'prom-dj',
    nav: 'Proms & student nights',
    title: 'Prom DJ and student night DJ for schools and universities · DJ KC',
    description:
      'Prom, leavers ball and student night DJ for schools and universities across the North West. Clean edits, DBS-checked crew on request, a mic for the awards. From £650.',
    eyebrow: 'Proms & student nights',
    h1: 'A prom DJ that the school and the students both approve',
    answer:
      'DJ KC plays proms, leavers balls and student nights across the North West from £650. Sets are age-appropriate with clean edits, the school gets a contract, risk assessment and DBS-checked crew on request, and the students get a floor that stays full until curfew.',
    facts: [
      { label: 'From', value: '£650 for two hours' },
      { label: 'Safeguarding', value: 'DBS-checked crew and risk assessment on request' },
      { label: 'Music', value: 'Clean edits only; no explicit content, ever' },
      { label: 'Format', value: 'Arrival set, awards and speeches, then the party' },
      { label: 'Travel', value: 'Included across the North West' },
      { label: 'Deposit', value: '50%, or school purchase order' },
    ],
    sections: [
      {
        q: 'What makes a prom booking different from a party?',
        a: 'Three things: the audience is under 18, the school is accountable for the room, and the evening has a formal shape — arrivals, awards, speeches, then dancing. KC brings clean edits, a mic for the awards and paperwork the school can file.',
      },
      {
        q: 'Do you play clean versions only?',
        a: 'Yes, always, without being asked. Every vocal record in a prom set is a clean edit, and the request list is checked the same way. If a student requests something explicit, it is declined politely and something adjacent gets played instead.',
      },
      {
        q: 'Can you provide a DBS check and risk assessment?',
        a: 'Yes. DBS-checked crew and a written risk assessment are available on request and usually needed for a school booking. The contract names the people attending, and the school office gets everything before the event.',
      },
      {
        q: 'What do students actually dance to at a prom?',
        a: 'Chart and dance anthems, garage and house, a run of throwbacks from the year they started school, and one slow song at the end that the year group chooses. KC asks the student committee for a must-play list a fortnight before.',
      },
      {
        q: 'How does a school pay for a prom DJ?',
        a: 'By purchase order or card. An invoice with the school as the customer, a purchase order reference and a 50% deposit or full payment on terms — whichever your finance office prefers. Nothing is charged until the contract is signed.',
      },
    ],
    faqs: [
      {
        q: 'How much does a prom DJ cost?',
        a: 'UK prom and leavers ball DJs typically charge £450–£900 for an evening. DJ KC charges from £650 for two hours with sound, lighting, a mic for the awards and clean edits throughout, with travel included across the North West.',
      },
      {
        q: 'Are your proms suitable for under-18s?',
        a: 'Yes. Every set uses clean edits, explicit tracks are declined, and DBS-checked crew and a written risk assessment are available on request. The music stays current without being inappropriate for a school audience.',
      },
      {
        q: 'Can you MC the awards and speeches?',
        a: 'Yes. The mic is live for arrivals, awards and thank-yous, with walk-up music per award and the volume dropped for speakers. The running order is agreed with staff in advance and adjusted on the night if it runs late.',
      },
      {
        q: 'How far in advance should a school book a prom DJ?',
        a: 'Three to six months ahead for a summer prom, and as early as the autumn term for a popular venue. School finance teams often need a term to raise a purchase order, so an early quote helps.',
      },
    ],
    running: [
      'Send the date, venue, year group and staff contact.',
      'Quote, contract, risk assessment and DBS details to the school office.',
      'Must-play list from the student committee a fortnight before.',
      'Arrival set, awards on the mic, then the party until curfew.',
    ],
    from: '650',
    fromLabel: 'from £650',
  },
];

/** The page that links them together, and the shared phrase used for it. */
export const EVENT_HUB = { id: 'event-types', nav: 'Occasions' };

export const eventBySlug = (slug: string) => EVENT_TYPES.find((entry) => entry.id === slug);

/** Two siblings to link to from each page, so the hub is never the only route. */
export const siblingsOf = (id: string, count = 2): EventType[] =>
  EVENT_TYPES.filter((entry) => entry.id !== id).slice(0, count);

/**
 * The canonical description of the act. One sentence, used verbatim on every
 * page, in schema, and in llms.txt, so engines attach one entity to the name
 * rather than blending in someone else's.
 */
export const CANONICAL_DESCRIPTION =
  'DJ KC is a house DJ, live vocalist and producer based in the North West of England, playing club nights, festivals, weddings and private events across the UK, Ireland and internationally.';
