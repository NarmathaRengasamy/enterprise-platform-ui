export const BRAND_LOGO_URL = "https://lh3.googleusercontent.com/aida/AEtjO1X6laTvUO_KReS_ys7J_3XzBFxMdAtL5ltgmz-gGvdsjSlAvIkWBgqPzyCU-nIHRo93RBGd86E-5qL6GbsT3gfC12_6sDaZrznf6cpAq0Y58_cAcmnLVTbTfTB-SAMVhXIcsRq92FXX492qZWmNqa588PqkDkULZ84GhtxS_mpMknpA6FzxrPtTrAds8v1G10snh7akx_6vFPk8rNhxTEXQ5M1DDi6B-1nQ6NVT8xV6nsUL8ui-GM_5yA";
export const USER_AVATAR_URL = "https://lh3.googleusercontent.com/aida-public/AB6AXuD7jQpTkjpDlbNPq9nvpZ3iYgDgqEpa_xjaklhelrSv8ESxKdHzFUjn6SIEWNvT7MP_GjI2NuRZaeSR33hrF6iCSxXxxKNl0yHrljwhxyuVacMJ0q8gdR1xWlhySKWFnDTR0hXshrG_slCgqC2KQBX5pDJlnfRdcy_PYFBQbXzD-yR11XH0ZM-DeeYOGeqnlg69hYiPZ53JgD3o-ztOX15QCsdVjUZqes4XraFkw-z1Scr_lRWhmyUt";

export const INITIAL_PRODUCTS = [
  {
    id: "PRD001",
    name: "Urban Tech Minimalist Backpack",
    shortName: "Product 1",
    sku: "PRD001",
    category: "Electronics",
    categoryCode: "electronics",
    price: 1299,
    originalPrice: 1899,
    stock: 142,
    stockStatus: "In Stock",
    committed: 18,
    reorderPoint: 25,
    margin: "54.2%",
    discount: "31% OFF",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAVx_w1b-jBtKZXpVi6Ukh4pLbitDr5sL2MLWUFFccWwloJqbl-gZNr-up80uDB63SsQo-7Wks4_G2wL-mxz79eOZGx0FM0-2egouMWfQnUM-9lwLQsAtD1_a_1VUWUNwOVajLgSGbdqX-Y4cMVMfy2gjf6MnJNwuTHq3sLrVU3gVt7Q_azaOsR9fInn9OK3UgmqKe0ZZL7JaLZVoaxcJ5sOemxlqflBCpl37am6kl7NZl0AdWXMBRH3DX6OfEA2vUA2g",
    gallery: [
      { id: 0, label: "Front", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuDkL475WkEFTbptqedqxJXGmgDFyKSvV-W3QERAOAUhIeUYXl4CXnSyqrxHnV6oAFqFvrXicx0ghAZ_6pd4p1XQTUXEu43PNLVblUC0CgvU4ubkgHBlIW02E12_T8Y_77lYpvd2s4AG1jJ1xnSVs1ThCTBnpYjzI6RKswawIHf_fXVwpUfMFxJdwD6ZMDaqYP7clcdKzu569nAUp_CJuPoT4_ij5Vfl7ciI8S0c_9dzVmpF5KjS5mU3" },
      { id: 1, label: "Side", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuC85TOdWoV5iDZgUjKsd7TnngJK3C_0f-yFL-iN2ZCdqnY_N1VzieuEPJKvhOCc4UtT8YW65aVwC4HSY189VihdAtuglf7ah9_6ggwgmxhuKYa0jDxa39LZbPa84Rly4iTuE1sYzYLjhEhwRpTYZwjceN6WCR-itk5Ze4174fi2F_9Xifj-tRDhW1WlOwGxSgLTbQQBQjDDziOpMEMll9zc3yujzkhpbDFi2mcPdcyMg2rSTIsffiOA" },
      { id: 2, label: "Angled", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuC76gtSrxWdmS3C_YuxfGLdNf0vSgUWzm21kNW5IPzMdHlAk44hUoyXs3lBO7t1NipRZBEYPlse1Q_1cZuUbccIrmwP1SkhPc41josZx7MHp6aHHWMNzyv3FJd06bOAzvBl6rUj7-t4KlvRoEedLF-ZAMWmenx9Tdh8k6lyZ6OaiCDLJxS0Ifod7y30JepnLI5E5NpnOkoz-5cshRXv3CoPII43QoeJ2TTMoHKQ4rReLJyH9fCkV33K" },
      { id: 3, label: "Detail", src: "https://lh3.googleusercontent.com/aida-public/AB6AXuCBt-Cx1MahLfxAZEBMR17TefDT0Dj5lKZz-2fibRRHJSdVIp6xVFsR0S7fDE6Eb00_TelWxtF-BtrRoUIp-Qycj0syq36DClPXhKDf3d_xyiZ4bzPAsLVQcsZ2QRtajV6iS7ZJGns6UXfYeKDmDMx6xv0BCwbKepdxyva4gXdFao6nf2a3r_cx39GZ0ZnyenoeBr5q1RnZ9zqaLMELyizmjCvzVQdAsWfxYllJcPjrS0yHWVOzom3a" },
    ],
    description: "Engineered with waterproof ballistic nylon and ergonomic memory-foam shoulder straps. Features an internal padded 16-inch laptop compartment, hidden passport pocket, and quick-access magnetic modular pockets for effortless daily transit and travel.",
    variants: [
      { option: "Size", value: "M (Medium 20L)", price: 3499, stock: "18 units", status: "In Stock" },
      { option: "Size", value: "L (Large 28L)", price: 4199, stock: "12 units", status: "In Stock" },
      { option: "Colorway", value: "Stealth Slate", price: 3799, stock: "4 units (Low)", status: "Low Stock" },
    ],
    videos: [
      { id: 0, duration: "0:45", title: "Product Showcase", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuBxMHkzIIY8MkLHWUc5HVNwkfHFABl5WOPPB6hiv3vAUTn9FQvpw6ckj7ZjbEhGNxibxVahw7wrEDZTGmQwHy6gombYcr0a1plfI7loq19sSh3eeCg0Kcvnlezv1Uy9Y76HbzA149ulzcH9CGazrTGEb6q8UbH1Pi5VoDxjMZg8dP76ShjbJac6j1OTP-YtkXSCs29-_CvWUqEl-eNojmNgqS5W6vi0t4XMzOWf5tpK3z8wxlQYTa0aVF8f0GJxsSRDjw" },
      { id: 1, duration: "1:20", title: "Durability & Transit Review", thumbnail: "https://lh3.googleusercontent.com/aida-public/AB6AXuBZpDtIoUBjAmvMjwWqS0WWlTWR-fposZDgY5don3zO14aFLWhoAyzm8zuZVoTGLTi7srIXbXe5Lkybw1IgTosPWlqIE8jBgZLIVOqlBD3b6MzXqqRJ2cOSXbcpc6xkFGVXdoRBIcjjfXQVsopslHDKPcu1EGfncfsB6PKIQTAtX12kQNL--e9WZHEXjUfMrru72dTyRCqw7hE99MPqFdsrXlvpbXK8o7Rlj5mssHclYSV8_FxEgQR04sTGKyMc8DjJAw" }
    ]
  },
  {
    id: "PRD002",
    name: "Classic Chrono Sport Watch",
    shortName: "Product 2",
    sku: "PRD002",
    category: "Accessories",
    categoryCode: "accessories",
    price: 499,
    originalPrice: 799,
    stock: 85,
    stockStatus: "In Stock",
    committed: 5,
    reorderPoint: 15,
    margin: "48.0%",
    discount: "37% OFF",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDZrinRWPtTLlEB_-W3lWqc70JxHDDbcey2X8dtpIUZRnz8hZePLumuUyeNysfQB2J6h4YR2riVLm_esiHoEH-V7gROFqM3uuuEv6NFTKf3uSKOcAt0i_Ooldhlz9uMLBX4uS0zQjTXe1ijlE0V3OgruckSDJ2JcsOMJoZDmygKF1bI3blzBbaVXBO0ZQKhyv5ZK7rpQAmnQEBW6VQNNfCNAGhkcCx7lsHem2mbYBcbPDQibLpAPh63Dbcxp73eRZl_4g",
    description: "Sleek water-resistant sports chronograph with sapphire crystal glass and durable silicone strap.",
    variants: [
      { option: "Color", value: "Midnight Black", price: 499, stock: "40 units", status: "In Stock" },
      { option: "Color", value: "Ocean Blue", price: 499, stock: "45 units", status: "In Stock" }
    ]
  },
  {
    id: "PRD003",
    name: "Nordic Minimalist Desk Lamp",
    shortName: "Product 3",
    sku: "PRD003",
    category: "Home",
    categoryCode: "lifestyle",
    price: 899,
    originalPrice: 1299,
    stock: 3,
    stockStatus: "Low Stock",
    committed: 2,
    reorderPoint: 10,
    margin: "42.5%",
    discount: "30% OFF",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCBm-EXDnlUuHyADDooFkdYBPITwxTppV_7UriG6Kp8D7jVt9mD8v8NZLHZffdl0iBG0sepJDQi1k67kVe8JRHKWctpAl66_saXg5AmeEKQORAtrlZZEaZq6c2o5uMFxePjjyPbJ8jMnsejzsKkqhvEvoJvP14kasRNfr4v9_u1mxyx0prvjnOWZ3Put71UogbUIP1Hx-z_tHG270OLcWqf4nUGM8_GqBZwuU1tBs8vR_iNbAxBqLgFEaHz3BSbx6nXRg",
    description: "Touch-activated dimmable LED desk lamp crafted with solid beechwood and matte powder-coated steel.",
    variants: [
      { option: "Finish", value: "Matte White", price: 899, stock: "2 units", status: "Low Stock" },
      { option: "Finish", value: "Matte Charcoal", price: 899, stock: "1 unit", status: "Low Stock" }
    ]
  },
  {
    id: "PRD004",
    name: "Tailored Linen Blend Overshirt",
    shortName: "Product 4",
    sku: "PRD004",
    category: "Fashion",
    categoryCode: "apparel",
    price: 1199,
    originalPrice: 1699,
    stock: 64,
    stockStatus: "In Stock",
    committed: 8,
    reorderPoint: 20,
    margin: "58.1%",
    discount: "29% OFF",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAWukTBkxmlZwM9l0nXUiLgW3RC3dwQtH_Zg2uZHHIXpMEm4E07y_v4S2nMwXdOP0l6FYEZfVrS4Nmd6JeYAUiyNqs2c8fAMyyMZ5dTlRVEnGTnrF_Y3Jen62qc_UslmiC6RxUCp6ikf7mw6ZhDVdzCZVcKIWiRCy7fajYDXT-5R1ToV0WaRR85nXi7kSW5_b9Vdl6eAaSB2fiLvR01frtrj3Qxkxh9RNA4q252XQsLbBnceuH_agxix55V4BQ5TWRDAw",
    description: "Breathable European flax blend overshirt designed with horn buttons and double chest utility pockets.",
    variants: [
      { option: "Size", value: "M", price: 1199, stock: "30 units", status: "In Stock" },
      { option: "Size", value: "L", price: 1199, stock: "34 units", status: "In Stock" }
    ]
  }
];

export const INITIAL_CATEGORIES = [
  {
    id: "CAT-001",
    name: "Electronics",
    description: "Electronic devices and gadgets",
    productsCount: 25,
    updated: "2d ago",
    icon: "devices",
    color: "primary"
  },
  {
    id: "CAT-002",
    name: "Accessories",
    description: "Accessories for all products",
    productsCount: 18,
    updated: "5d ago",
    icon: "headphones",
    color: "secondary"
  },
  {
    id: "CAT-003",
    name: "Home",
    description: "Home decor, furniture, and kitchen items",
    productsCount: 18,
    updated: "1w ago",
    icon: "chair",
    color: "tertiary"
  },
  {
    id: "CAT-004",
    name: "Fashion",
    description: "Apparel, footwear, and style collections",
    productsCount: 14,
    updated: "3d ago",
    icon: "apparel",
    color: "primary"
  }
];

export const INITIAL_CONVERSATIONS = [
  {
    id: "convo-1",
    name: "Aarav Sharma",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCKFmunIy3-evpPE9uq4tAsikVZJsjIcbM98yVf6taIVV9fcRZpyMsOOYSR7gE14Fp7dci_0tSkfSfGkOl0Xkqrjmfds4KYlrSwuEdDe7hZa2tFGG_-4MKDVRAX0I3Bf47WtMKJaqqxqomgMV2GrkYyQDMNfhXMa9RioY13aQXur0FNjyP9YsEKOd6JHfi4TZCXGlkhufXk1qR4BG4HsRoSgjvXQ17EKihEcy-rmpGhTZDWtJ1wqdsQMw",
    channel: "whatsapp",
    channelLabel: "WhatsApp",
    channelColor: "emerald",
    phone: "+91 98201 44521",
    email: "aarav@apexretail.in",
    unread: 2,
    timestamp: "10:42 AM",
    lastMessage: "Hi, could you send the quote for the Office Ergonomic...",
    messages: [
      {
        id: "m1",
        sender: "them",
        text: "Good morning Devon. We are finalizing our regional HQ refurbishment across Mumbai & Bengaluru. We need 48 ergonomic desk units.",
        time: "10:14 AM"
      },
      {
        id: "m2",
        sender: "me",
        text: "Hello Aarav! Outstanding news. We currently have standard commercial stock in Pune hub ready for 72-hour dispatch.",
        time: "10:18 AM"
      },
      {
        id: "m3",
        sender: "them",
        text: "Hi, could you send the quote for the Office Ergonomic Chairs (Large variant) and schedule a demo?",
        time: "10:39 AM",
        attachment: {
          title: "Apex Executive Chair",
          sku: "ERGO-X9-PRO",
          status: "In Stock",
          image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAy_f1NBsFJIrjXllqBAXCSkx8ErDxPXv9FJHKQKzVXxlAuE-M5nTgFOPSyTCYCxCAW6qf071JiTmBW6qR6DmBgtTdGR9arDmL8UFK680ZCJ2paI8q3OVKrelB2fMHha5ChqfqXfXBtLaA-KoXXoMn5vFitnHAmd-TbUmdcKoOejbsk3UejVjPcsSPiJKhjgNcn2rPWCWpcUVVbuzUi-000dW2UjIcpy6_GZ59mywZUdnL7iFPEdzC_Mw"
        }
      }
    ]
  },
  {
    id: "convo-2",
    name: "Priya Patel",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuA4t8AMpjVV6rJhzRmA3T2nB4m-rGn3C7H7G26Xf_2CjaG0U65h7Md6ai-Kgu5sEsgTO5xURNEVx1CXBVkf7ygar8xdVkSX9yOm_BJfuIfYZPRfw0dDNIJKK05E_WrU0lpxuKhq4xhQncJcZbLYF8J4le-GuYz6WSgYUdReSOHc89PojuG7LlrG6Y7lEF_lfwsGKi5XS8E6YRi9KpAAVHQksTs73g5mMULlqr1fB4-7Bm7dZ-kjg_1gnA",
    channel: "sms",
    channelLabel: "SMS",
    channelColor: "amber",
    phone: "+91 94451 88321",
    email: "priya@urbanstudio.in",
    unread: 0,
    timestamp: "09:15 AM",
    lastMessage: "Thanks Devon! We received the updated invoice #4928.",
    messages: [
      {
        id: "m201",
        sender: "me",
        text: "Hi Priya, attached is the updated invoice #4928 for the fabric upholstery sample kit.",
        time: "09:10 AM"
      },
      {
        id: "m202",
        sender: "them",
        text: "Thanks Devon! We received the updated invoice #4928.",
        time: "09:15 AM"
      }
    ]
  },
  {
    id: "convo-3",
    name: "Vikram Malhotra",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDd4XZ-EKcOX2A1jkkoBW_bASdMQY5NrAmSMEQ9-CLIsEy-aZPIFzDgVdq07JK_sbt96GeTTmggEDjg2Bh7EY0cM4__pL33z1AjbydHfJKo5911VCQOQEtallmcA-bImaEzgMN9c8IsoBON_PSyapQSnE-Vagp3cOnpYJe_DWNXy5LF9jlGktLRf4N6WspSdAgHM5iN7D7xG2YLxP70Lt29KB56Ky8a5ypBzpNkv1mOz_pmcI3QN_gU7g",
    channel: "email",
    channelLabel: "Email",
    channelColor: "sky",
    phone: "+91 98840 11920",
    email: "v.malhotra@zenithcorp.com",
    unread: 1,
    timestamp: "Yesterday",
    lastMessage: "Fwd: Security clearance checklist sandbox",
    messages: [
      {
        id: "m301",
        sender: "them",
        text: "Fwd: Security clearance checklist sandbox. Please review the OAuth2 scopes and SSO tokens before tomorrow's audit.",
        time: "Yesterday 4:30 PM"
      }
    ]
  },
  {
    id: "convo-4",
    name: "Sarah Jenkins",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDvsA0SyRMgVDd_ZvHO7xR-KX4vzsILGoQaRYH6T8O-pXTAj5t3wZQkf118gAFZZb6mE-gjUpNVRrwMfS-jPwPcd4IY3rzmp-CXeamPaIne3oriZhmtXN4VYL1GAIVE7k2VUv0XzcTon3zDYJw-u1yPAquvFvNDSbFPBLJaWrSkHNFxn4vQD1-TyaTmWzOSsv4UzZ8_l3RhHXewijfj2KPpT9c1RoXV01NH3w2MLjL8vtyX3-at_Y9X0g",
    channel: "voice",
    channelLabel: "Phone",
    channelColor: "purple",
    phone: "+44 20 7946 0912",
    email: "sarah.j@omniflow.io",
    unread: 0,
    timestamp: "2d ago",
    lastMessage: "Call recording: Confirmed product specs",
    messages: [
      {
        id: "m401",
        sender: "them",
        text: "Call recording transcript: Confirmed 24 custom walnut executive desks for Phase 2 rollout.",
        time: "2d ago"
      }
    ]
  },
  {
    id: "convo-5",
    name: "David Miller",
    avatar: "",
    initials: "DM",
    channel: "whatsapp",
    channelLabel: "WhatsApp",
    channelColor: "emerald",
    phone: "+44 7700 900077",
    email: "david@logistics-uk.co",
    unread: 0,
    timestamp: "Oct 22",
    lastMessage: "Catalog dispatch arrived at Southampton hub.",
    messages: [
      {
        id: "m501",
        sender: "them",
        text: "Catalog dispatch arrived at Southampton hub. Clearance processed smoothly.",
        time: "Oct 22 11:15 AM"
      }
    ]
  }
];

export const INITIAL_TEAM = [
  {
    id: "team-1",
    name: "John Doe",
    email: "john@example.com",
    department: "Product Engineering",
    role: "Admin",
    status: "Active",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuAFkOnv9voeucwRjCIiqMFnK-BeVUegzjitgpks0FHkHwRY_3lJXew0ypnFSM1YBIeJf01Wy1yrNjffNkVqGWyvGDiv0AQ1jgzXycZhKQ96CKAyGoCkSvE5NSXzpRxNapyzvxUWJEeTdq_KRl8xOKw4PcpoMe75QSPqb8b-ypbZS2ECAhFH9r1-_1wE3aDo-W0WRyRIOjJTUHGHcUw-ZVAmWRtkr9epjcaXOMZCMEpoTOIi4q-Ge_aJ"
  },
  {
    id: "team-2",
    name: "Jane Smith",
    email: "jane@example.com",
    department: "Content Operations",
    role: "Editor",
    status: "Active",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuDfZHBmhV-j_SZWz9PPhHwAW5ab127aYuTNkXyZVLWClJWTDEbfpAPM1U4tzM1nGEtHq3tXPdEJDWnr7dpJvA8LZdIuo1KbvMnwA0LjYFzoHWd3KiareYYwmHrBD0tHeD0CcMJiy9YJhNyGX7t5l-jhJ_Zj4HuLju0V7SGRcHSIq_hBwJngieafSW0JIK6iqxTIgHp3Gp9tETNIFONKKJcqQGuCQ6MxLB70m7AKbv-dv0AoU-9VIVi7"
  },
  {
    id: "team-3",
    name: "Bob Wilson",
    email: "bob@example.com",
    department: "Customer Success",
    role: "Viewer",
    status: "Pending",
    avatar: "https://lh3.googleusercontent.com/aida-public/AB6AXuCHrG0_3RkE1GZJjL4vS1K48_lM1P0kZ2h5M0u8_h3qJ2w7m1a9fL2r5vP3oQ4_xG4eD9m4y8K3m7d0-oP1qK4o2w3x8y7a-mN6z0e"
  }
];

export const INITIAL_ARTICLES = [
  {
    id: "art-1",
    title: "How to place an order",
    category: "Orders",
    categoryColor: "primary",
    readTime: "4 min read",
    visibility: "Public article",
    updated: "10 Sep 2026",
    icon: "shopping_bag",
    views: "2,420",
    content: "Learn how customers and agents can initiate bulk commercial orders directly from the Perfox storefront or through the AI assistant widget."
  },
  {
    id: "art-2",
    title: "Return & Refund Policy",
    category: "Orders",
    categoryColor: "primary",
    readTime: "3 min read",
    visibility: "Public article",
    updated: "08 Sep 2026",
    icon: "assignment_return",
    views: "1,890",
    content: "Standard 30-day return policies for furniture, electronics, and accessories, including return pickup logistics."
  },
  {
    id: "art-3",
    title: "Shipping Zones & Delivery Times",
    category: "Shipping",
    categoryColor: "secondary",
    readTime: "5 min read",
    visibility: "Public article",
    updated: "02 Sep 2026",
    icon: "local_shipping",
    views: "4,120",
    content: "Detailed SLAs for metro, tier-2 cities, and international freight forwarding destinations."
  },
  {
    id: "art-4",
    title: "AI Widget Embedding & Troubleshooting",
    category: "Developer",
    categoryColor: "tertiary",
    readTime: "6 min read",
    visibility: "Internal & Public",
    updated: "12 Sep 2026",
    icon: "integration_instructions",
    views: "980",
    content: "Guide on embedding the script tag, configuring CORS origins, and setting custom accent colors."
  }
];

export const INITIAL_COLLECTIONS = [
  {
    id: "col-1",
    title: "Customer Onboarding & FAQ",
    description: "General FAQs, order tracking instructions, and warranty terms for customers.",
    articleCount: 8,
    icon: "contact_support",
    color: "primary"
  },
  {
    id: "col-2",
    title: "Perfox Product Catalogs & Markdown",
    description: "Auto-synced markdown summaries of furniture, electronics, and store items for LLM knowledge retrieval.",
    articleCount: 12,
    icon: "menu_book",
    color: "secondary"
  },
  {
    id: "col-3",
    title: "Logistics, Delivery & Installation",
    description: "Warehouse dispatches, on-site assembly instructions, and transit tracking guides.",
    articleCount: 4,
    icon: "local_shipping",
    color: "tertiary"
  }
];

export const INITIAL_CALENDAR_EVENTS = [
  {
    id: "ev-1",
    title: "Consultation with Apex Group",
    time: "09:00 AM - 10:00 AM",
    startTime: "09:00",
    endTime: "10:00",
    dayIndex: 3, // Wednesday
    topOffset: 64, // corresponds to 9am in hourly grid
    height: 64,
    client: "Aarav Sharma",
    type: "Commercial Quote",
    location: "Teams Video Call",
    status: "Confirmed",
    statusColor: "emerald"
  },
  {
    id: "ev-2",
    title: "Site Measurement - Villa 402",
    time: "11:30 AM - 01:00 PM",
    startTime: "11:30",
    endTime: "13:00",
    dayIndex: 3, // Wednesday
    topOffset: 224,
    height: 96,
    client: "Priya Patel",
    type: "On-site Visit",
    location: "Koramangala 4th Block, BLR",
    status: "Confirmed",
    statusColor: "emerald"
  },
  {
    id: "ev-3",
    title: "Material Selection - Studio",
    time: "02:30 PM - 03:30 PM",
    startTime: "14:30",
    endTime: "15:30",
    dayIndex: 4, // Thursday
    topOffset: 416,
    height: 64,
    client: "Vikram Malhotra",
    type: "Sample Review",
    location: "Design Studio Floor 2",
    status: "Pending",
    statusColor: "amber"
  },
  {
    id: "ev-4",
    title: "Weekly Omnichannel Review",
    time: "04:00 PM - 05:00 PM",
    startTime: "16:00",
    endTime: "17:00",
    dayIndex: 5, // Friday
    topOffset: 512,
    height: 64,
    client: "Internal Team",
    type: "Strategy Sync",
    location: "Boardroom A",
    status: "Confirmed",
    statusColor: "emerald"
  }
];
