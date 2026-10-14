/**
 * DevSync Mock Dataset
 * Faithful reproduction of Reference Image 1 & product specifications
 */

export const INITIAL_MOCK_DATA = {
  currentUser: {
    id: 'user_naveen',
    name: 'Naveen Kumar D',
    username: 'naveen3438',
    email: 'naveen@devsync.dev',
    role: 'Developer',
    isVerified: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
    headline: 'BCA student and passionate developer focused on building meaningful web applications and exploring new technologies. Interested in full-stack development, open source and developer communities.',
    bio: "I'm a BCA student at Bengaluru City University with a strong interest in web development, backend systems and developer tools. I enjoy building real world projects, learning new technologies and collaborating with other developers. Currently exploring Django, Flask and cloud deployment. My goal is to work on impactful projects and contribute to open source.",
    location: 'Bengaluru, India',
    website: 'https://naveenkumar.dev',
    social: {
      github: 'https://github.com/naveen3438',
      linkedin: 'https://linkedin.com/in/naveen-kumar',
      instagram: 'https://instagram.com/naveen.dev'
    },
    collaborationStatus: 'Available for collaboration',
    collaborationStatusType: 'available',
    openToInvitations: true,
    education: {
      degree: 'BCA Student',
      institution: 'Bengaluru City University',
      location: 'Bengaluru, India',
      field: 'Computer Applications',
      timeline: '2022 - 2025'
    },
    experience: [
      {
        role: 'Full Stack Intern',
        organization: 'Chaturya Tech Club',
        timeline: '2023 - Present',
        description: 'Building event registration portals and student developer community platforms with Django.'
      }
    ],
    stats: {
      followers: 24,
      following: 18,
      projects: 5,
      teams: 2,
      repositoriesCount: 12,
      contributionsCount: 48,
      pullRequestsCount: 8,
      issuesCount: 24
    },
    skills: [
      { name: 'Python', category: 'Backend', color: 'blue' },
      { name: 'Django', category: 'Backend', color: 'mint' },
      { name: 'Flask', category: 'Backend', color: 'blue' },
      { name: 'Java', category: 'Backend', color: 'blue' },
      { name: 'JavaScript', category: 'Frontend', color: 'amber' },
      { name: 'HTML', category: 'Frontend', color: 'rose' },
      { name: 'CSS', category: 'Frontend', color: 'purple' },
      { name: 'MySQL', category: 'Database', color: 'cyan' },
      { name: 'Git', category: 'Tool', color: 'neutral' },
      { name: 'GitHub', category: 'Tool', color: 'neutral' },
      { name: 'Bootstrap', category: 'Frontend', color: 'purple' },
      { name: 'SQL', category: 'Database', color: 'cyan' }
    ],
    pinnedProjects: ['repo-chaturya', 'repo-college', 'repo-portfolio'],
    projects: [
      {
        id: 'repo-chaturya',
        name: 'chaturyanew',
        description: 'Student developers club website built with Django. Event registrations, workshops and community features.',
        tags: [
          { name: 'Python', color: 'blue' },
          { name: 'Django', color: 'mint' },
          { name: 'Bootstrap', color: 'purple' }
        ],
        stars: 28,
        forks: 6,
        updated: 'Updated 2 days ago',
        visibility: 'Public',
        iconBg: '#10B981',
        iconType: 'club',
        relationship: 'Owner'
      },
      {
        id: 'repo-college',
        name: 'college-portal',
        description: 'Multi-tenant college website for Seshadripuram with admissions, dashboard and student portal.',
        tags: [
          { name: 'Flask', color: 'blue' },
          { name: 'SQLite', color: 'blue' },
          { name: 'Bootstrap', color: 'purple' }
        ],
        stars: 15,
        forks: 4,
        updated: 'Updated 1 week ago',
        visibility: 'Private',
        iconBg: '#6366F1',
        iconType: 'college',
        relationship: 'Owner'
      },
      {
        id: 'repo-portfolio',
        name: 'portfolio-site',
        description: 'Personal portfolio website with modern UI and responsive design.',
        tags: [
          { name: 'JavaScript', color: 'amber' },
          { name: 'HTML', color: 'rose' },
          { name: 'CSS', color: 'purple' }
        ],
        stars: 12,
        forks: 3,
        updated: 'Updated 3 weeks ago',
        visibility: 'Public',
        iconBg: '#1E293B',
        iconType: 'web',
        relationship: 'Owner'
      },
      {
        id: 'repo-devsync',
        name: 'DevSync Core',
        description: 'Main platform for developer collaboration with repositories, teams and discussions.',
        tags: [
          { name: 'Python', color: 'blue' },
          { name: 'Django', color: 'mint' },
          { name: 'PostgreSQL', color: 'cyan' }
        ],
        stars: 42,
        forks: 11,
        updated: 'Updated 5 days ago',
        visibility: 'Public',
        iconBg: '#0D9488',
        iconType: 'core',
        relationship: 'Contributor'
      },
      {
        id: 'repo-events',
        name: 'Event Management',
        description: 'Cultural and technical event management system for college.',
        tags: [
          { name: 'Python', color: 'blue' },
          { name: 'Flask', color: 'blue' },
          { name: 'Bootstrap', color: 'purple' }
        ],
        stars: 18,
        forks: 7,
        updated: 'Updated 2 weeks ago',
        visibility: 'Public',
        iconBg: '#10B981',
        iconType: 'event',
        relationship: 'Owner'
      },
      {
        id: 'repo-ai',
        name: 'AI Chatbot',
        description: 'Floating AI assistant for DevSync to help developers with coding and debugging.',
        tags: [
          { name: 'JavaScript', color: 'amber' },
          { name: 'Python', color: 'blue' },
          { name: 'API', color: 'cyan' }
        ],
        stars: 25,
        forks: 9,
        updated: 'Updated 1 week ago',
        visibility: 'Public',
        iconBg: '#8B5CF6',
        iconType: 'ai',
        relationship: 'Contributor'
      }
    ],
    achievements: [
      {
        id: 'ach-1',
        title: 'First Project',
        description: 'Created your first public project',
        color: 'green',
        icon: 'shield-check',
        date: 'Jan 2024'
      },
      {
        id: 'ach-2',
        title: 'Collaborator',
        description: 'Worked with 5+ developers',
        color: 'blue',
        icon: 'shield-users',
        date: 'Mar 2024'
      },
      {
        id: 'ach-3',
        title: 'Consistent',
        description: 'Active for 30+ days',
        color: 'purple',
        icon: 'shield-zap',
        date: 'May 2024'
      }
    ],
    activities: [
      {
        id: 'act-1',
        type: 'project_updated',
        title: 'Updated chaturyanew',
        description: 'Pushed 4 commits to main: Added registration endpoint with QR code verification.',
        time: '2 days ago',
        project: 'chaturyanew'
      },
      {
        id: 'act-2',
        type: 'milestone_completed',
        title: 'Milestone Completed in DevSync Core',
        description: 'Completed Milestone: Developer Public Profile System & AI Assistant integration.',
        time: '5 days ago',
        project: 'DevSync Core'
      },
      {
        id: 'act-3',
        type: 'team_joined',
        title: 'Joined Chaturya Developers team',
        description: 'Accepted invitation to collaborate on open source student developer projects.',
        time: '1 week ago',
        team: 'Chaturya Developers'
      },
      {
        id: 'act-4',
        type: 'project_created',
        title: 'Created repository AI Chatbot',
        description: 'Initialized repository with vanilla JS floating assistant widget and documentation.',
        time: '2 weeks ago',
        project: 'AI Chatbot'
      }
    ],
    teams: [
      {
        id: 'team-chaturya',
        name: 'Chaturya Developers',
        role: 'Lead Maintainer',
        membersCount: 8,
        avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=64&q=80',
        description: 'Student developers club and open-source project incubator.'
      },
      {
        id: 'team-devsync',
        name: 'DevSync Core Team',
        role: 'Core Contributor',
        membersCount: 14,
        avatar: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=64&q=80',
        description: 'Engineers building the DevSync collaboration and productivity platform.'
      }
    ],
    collaborators: [
      {
        name: 'Priya S',
        username: 'priyas',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
        role: 'Fullstack Developer',
        sharedProjectsCount: 3
      },
      {
        name: 'Ananya Roy',
        username: 'ananyaroy',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=64&q=80',
        role: 'Cloud Engineer',
        sharedProjectsCount: 2
      },
      {
        name: 'Vikram Rao',
        username: 'vikramrao',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=64&q=80',
        role: 'ML Engineer',
        sharedProjectsCount: 2
      }
    ]
  },

  overviewMetrics: {
    repositories: { count: 12, trend: 20, isUp: true },
    pullRequests: { count: 8, trend: 14, isUp: true },
    issues: { count: 24, trend: 6, isUp: false },
    teamMembers: { count: 6, trend: 33, isUp: true }
  },

  repositories: [
    {
      id: 'repo-1',
      name: 'devsync-core',
      description: 'Core backend services for DevSync',
      language: 'Python',
      languageColor: '#3572A5',
      stars: 28,
      forks: 5,
      updated: '2 hours ago',
      visibility: 'Private',
      defaultBranch: 'main',
      filesCount: 42,
      branchesCount: 4
    },
    {
      id: 'repo-2',
      name: 'campus-connect',
      description: 'College community platform',
      language: 'Django',
      languageColor: '#092E20',
      stars: 18,
      forks: 3,
      updated: '5 hours ago',
      visibility: 'Public',
      defaultBranch: 'main',
      filesCount: 68,
      branchesCount: 3
    },
    {
      id: 'repo-3',
      name: 'portfolio-site',
      description: 'Personal portfolio website',
      language: 'JavaScript',
      languageColor: '#F7DF1E',
      stars: 12,
      forks: 4,
      updated: '1 day ago',
      visibility: 'Public',
      defaultBranch: 'main',
      filesCount: 24,
      branchesCount: 2
    },
    {
      id: 'repo-4',
      name: 'ai-tools',
      description: 'Collection of useful AI tools',
      language: 'TypeScript',
      languageColor: '#3178C6',
      stars: 9,
      forks: 2,
      updated: '2 days ago',
      visibility: 'Private',
      defaultBranch: 'main',
      filesCount: 31,
      branchesCount: 2
    },
    {
      id: 'repo-5',
      name: 'chaturya-club',
      description: 'Student developers club website',
      language: 'Flask',
      languageColor: '#000000',
      stars: 7,
      forks: 1,
      updated: '4 days ago',
      visibility: 'Public',
      defaultBranch: 'main',
      filesCount: 19,
      branchesCount: 1
    },
    {
      id: 'repo-6',
      name: 'heavy-machinery',
      description: 'Automated deployment and backup infrastructure scripts',
      language: 'Python',
      languageColor: '#3572A5',
      stars: 15,
      forks: 4,
      updated: '5 days ago',
      visibility: 'Private',
      defaultBranch: 'main',
      filesCount: 16,
      branchesCount: 2
    }
  ],

  pullRequests: [
    {
      id: 'pr-42',
      number: 42,
      title: 'Add user authentication with Google OAuth',
      author: 'Priya',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
      repository: 'campus-connect',
      labels: ['enhancement', 'auth'],
      reviewers: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80'
      ],
      commentsCount: 4,
      status: 'Open',
      statusClass: 'badge-status-open',
      updated: '2 hours ago',
      sourceBranch: 'feat/google-oauth',
      targetBranch: 'main',
      description: 'Implements Google OAuth 2.0 flow using django-allauth library with secure token verification.'
    },
    {
      id: 'pr-41',
      number: 41,
      title: 'Fix navbar responsive issue on mobile',
      author: 'Arjun',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80',
      repository: 'portfolio-site',
      labels: ['bug', 'frontend'],
      reviewers: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80'
      ],
      commentsCount: 2,
      status: 'Open',
      statusClass: 'badge-status-open',
      updated: '5 hours ago',
      sourceBranch: 'fix/mobile-navbar',
      targetBranch: 'main',
      description: 'Ensures menu links collapse into the drawer on mobile viewport sizes.'
    },
    {
      id: 'pr-39',
      number: 39,
      title: 'Improve database schema and add indexes',
      author: 'Karthik',
      authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80',
      repository: 'devsync-core',
      labels: ['database', 'performance'],
      reviewers: [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80'
      ],
      commentsCount: 6,
      status: 'Review',
      statusClass: 'badge-status-review',
      updated: '1 day ago',
      sourceBranch: 'perf/db-indexes',
      targetBranch: 'main',
      description: 'Adds composite indexes on foreign keys to optimize query execution.'
    },
    {
      id: 'pr-38',
      number: 38,
      title: 'Add image upload for gallery',
      author: 'Sneha',
      authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&q=80',
      repository: 'chaturya-club',
      labels: ['feature', 'media'],
      reviewers: [
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80'
      ],
      commentsCount: 3,
      status: 'Open',
      statusClass: 'badge-status-open',
      updated: '2 days ago',
      sourceBranch: 'feat/gallery-upload',
      targetBranch: 'main',
      description: 'Enables multipart image uploads with automatic thumbnail generation.'
    },
    {
      id: 'pr-36',
      number: 36,
      title: 'Refactor API endpoints',
      author: 'Balaji',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
      repository: 'devsync-core',
      labels: ['refactor', 'backend'],
      reviewers: [
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80'
      ],
      commentsCount: 5,
      status: 'Merged',
      statusClass: 'badge-status-merged',
      updated: '3 days ago',
      sourceBranch: 'refactor/rest-endpoints',
      targetBranch: 'main',
      description: 'Standardized response serializations and paginator interfaces across API controllers.'
    }
  ],

  issues: [
    {
      id: 'issue-104',
      number: 104,
      title: 'Add dark mode support',
      repository: 'portfolio-site',
      labels: ['enhancement', 'UI'],
      author: 'Priya',
      authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
      commentsCount: 5,
      updated: '2 hours ago',
      status: 'Open',
      description: 'Provide an accessible dark mode theme toggle that syncs with system preferences.'
    },
    {
      id: 'issue-102',
      number: 102,
      title: 'Fix file upload size limit',
      repository: 'campus-connect',
      labels: ['bug', 'backend'],
      author: 'Arjun',
      authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80',
      commentsCount: 3,
      updated: '5 hours ago',
      status: 'Open',
      description: 'Files larger than 10MB trigger an unhandled 413 error in upload endpoint.'
    },
    {
      id: 'issue-99',
      number: 99,
      title: 'Add analytics dashboard',
      repository: 'devsync-core',
      labels: ['feature', 'analytics'],
      author: 'Sneha',
      authorAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&q=80',
      commentsCount: 7,
      updated: '1 day ago',
      status: 'Open',
      description: 'Provide commit volume trends and team velocity heatmaps.'
    },
    {
      id: 'issue-94',
      number: 94,
      title: 'Improve mobile layout',
      repository: 'chaturya-club',
      labels: ['UI', 'responsive'],
      author: 'Balaji',
      authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
      commentsCount: 2,
      updated: '2 days ago',
      status: 'Open',
      description: 'Ensure cards and tables scale gracefully on small mobile screens.'
    },
    {
      id: 'issue-88',
      number: 88,
      title: 'Database backup script',
      repository: 'heavy-machinery',
      labels: ['infrastructure', 'database'],
      author: 'Karthik',
      authorAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80',
      commentsCount: 4,
      updated: '3 days ago',
      status: 'Open',
      description: 'Automate daily pg_dump backups to S3-compatible cold storage bucket.'
    }
  ],

  teamMembers: [
    {
      id: 'member-1',
      name: 'Balaji (you)',
      username: 'Balajikumar',
      role: 'Owner',
      repositoriesCount: 12,
      contributionsCount: 245,
      isOnline: true,
      joined: 'Jan 2024',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80'
    },
    {
      id: 'member-2',
      name: 'Priya S',
      username: 'priyas',
      role: 'Developer',
      repositoriesCount: 8,
      contributionsCount: 132,
      isOnline: true,
      joined: 'Feb 2024',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80'
    },
    {
      id: 'member-3',
      name: 'Arjun',
      username: 'arjun',
      role: 'Developer',
      repositoriesCount: 6,
      contributionsCount: 98,
      isOnline: false,
      joined: 'Mar 2024',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&q=80'
    },
    {
      id: 'member-4',
      name: 'Sneha',
      username: 'sneha',
      role: 'Developer',
      repositoriesCount: 5,
      contributionsCount: 76,
      isOnline: true,
      joined: 'Mar 2024',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=64&q=80'
    },
    {
      id: 'member-5',
      name: 'Karthik',
      username: 'karthik',
      role: 'Developer',
      repositoriesCount: 7,
      contributionsCount: 114,
      isOnline: true,
      joined: 'Apr 2024',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80'
    },
    {
      id: 'member-6',
      name: 'Rohan',
      username: 'rohan',
      role: 'Designer',
      repositoriesCount: 4,
      contributionsCount: 52,
      isOnline: false,
      joined: 'May 2024',
      avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=64&q=80'
    }
  ],

  developers: [
    {
      id: 'dev-naveen',
      name: 'Naveen Kumar D',
      username: 'naveen3438',
      role: 'Developer',
      isVerified: true,
      bio: 'BCA student and passionate developer focused on building meaningful web applications and exploring new technologies. Interested in full-stack development, open source and developer communities.',
      headline: 'BCA student and passionate developer focused on building meaningful web applications and exploring new technologies.',
      location: 'Bengaluru, India',
      website: 'https://naveenkumar.dev',
      social: {
        github: 'https://github.com/naveen3438',
        linkedin: 'https://linkedin.com/in/naveen-kumar',
        instagram: 'https://instagram.com/naveen.dev'
      },
      collaborationStatus: 'Available for collaboration',
      collaborationStatusType: 'available',
      openToInvitations: true,
      skills: ['Python', 'Django', 'Flask', 'Java', 'JavaScript', 'HTML', 'CSS', 'MySQL', 'Git', 'GitHub', 'Bootstrap', 'SQL'],
      connectionState: 'Connected',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'
    },
    {
      id: 'dev-balaji',
      name: 'Balaji',
      username: 'Balajikumar',
      role: 'Core Contributor',
      isVerified: true,
      bio: 'Fullstack engineer & open-source contributor. Building high-performance developer tools and collaboration systems.',
      headline: 'Fullstack engineer & open-source contributor.',
      location: 'Chennai, India',
      website: 'https://balajikumar.dev',
      social: {
        github: 'https://github.com/balajiaj2310',
        linkedin: 'https://linkedin.com/in/balaji',
        instagram: 'https://instagram.com/balaji'
      },
      collaborationStatus: 'Open to project invitations',
      collaborationStatusType: 'available',
      openToInvitations: true,
      skills: ['Python', 'Django', 'JavaScript', 'PostgreSQL', 'Docker'],
      connectionState: 'Connected',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80'
    },
    {
      id: 'dev-1',
      name: 'Ananya Roy',
      username: 'ananyaroy',
      bio: 'Fullstack engineer passionate about cloud microservices and scalable web applications.',
      skills: ['Python', 'React', 'PostgreSQL', 'Docker'],
      connectionState: 'Not Connected',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80'
    },
    {
      id: 'dev-2',
      name: 'Vikram Rao',
      username: 'vikramrao',
      bio: 'Machine Learning specialist, working with PyTorch, model deployment, and FastAPI.',
      skills: ['PyTorch', 'FastAPI', 'Docker', 'Python'],
      connectionState: 'Request Sent',
      avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&q=80'
    },
    {
      id: 'dev-3',
      name: 'Tara Patel',
      username: 'tarapatel',
      bio: 'DevOps & Site Reliability Engineer focused on Kubernetes orchestration and Terraform.',
      skills: ['Kubernetes', 'Terraform', 'Go', 'AWS'],
      connectionState: 'Accept Request',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80'
    },
    {
      id: 'dev-4',
      name: 'Rahul Dev',
      username: 'rahuldev',
      bio: 'Frontend enthusiast crafting accessible design systems and lightning-fast web experiences.',
      skills: ['TypeScript', 'Vue', 'CSS Architecture'],
      connectionState: 'Connected',
      avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=120&q=80'
    }
  ],

  channels: [
    { id: 'ch-general', name: 'general', unread: false, desc: 'General developer discussions and team chat' },
    { id: 'ch-frontend', name: 'frontend', unread: true, desc: 'UI architecture, HTML5, CSS design tokens, JavaScript' },
    { id: 'ch-django-backend', name: 'django-backend', unread: false, desc: 'Django APIs, PostgreSQL modeling, async tasks' },
    { id: 'ch-showcase', name: 'showcase', unread: false, desc: 'Show off your completed repositories and pull requests' },
    { id: 'ch-announcements', name: 'announcements', unread: false, desc: 'Platform announcements and release notes' }
  ],

  communityMessages: [
    {
      id: 'msg-1',
      channelId: 'ch-general',
      author: 'Priya S',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=64&q=80',
      time: '10:24 AM',
      text: 'Good morning everyone! Just pushed the initial commit for OAuth integration.'
    },
    {
      id: 'msg-2',
      channelId: 'ch-general',
      author: 'Balaji',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=64&q=80',
      time: '10:28 AM',
      text: 'Awesome work Priya! I will review PR #42 shortly. The architecture looks clean.'
    },
    {
      id: 'msg-3',
      channelId: 'ch-general',
      author: 'Karthik',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=64&q=80',
      time: '11:15 AM',
      text: 'Database indexes are staged in #39. Query times dropped from 240ms to 18ms.'
    }
  ],

  aiSuggestions: [
    { label: 'Explain this code', prompt: 'Explain the architecture and responsibilities of this module.' },
    { label: 'Help me debug this error', prompt: 'How do I resolve a Django CSRF verification failure on API endpoints?' },
    { label: 'Summarize pull request #42', prompt: 'Provide a concise summary of PR #42 Google OAuth changes.' },
    { label: 'Suggest unit tests', prompt: 'Suggest unit test cases for token verification and rate limiting.' },
    { label: 'Draft commit message', prompt: 'Draft a conventional commit message for refactored API serializers.' },
    { label: 'Help write a README', prompt: 'Generate a clean README.md template for a Django REST service.' }
  ],

  notifications: [
    {
      id: 'notif-1',
      title: 'New Pull Request Review',
      message: 'Priya requested your review on PR #42: Add user authentication with Google OAuth.',
      time: '2 hours ago',
      unread: true,
      link: '/frontend/src/pages/pull-requests/detail.html'
    },
    {
      id: 'notif-2',
      title: 'Connection Request',
      message: 'Tara Patel sent you a connection request.',
      time: '4 hours ago',
      unread: true,
      link: '/frontend/src/pages/developers/connections.html'
    },
    {
      id: 'notif-3',
      title: 'Issue Assigned',
      message: 'You were assigned to Issue #94: Improve mobile layout.',
      time: '1 day ago',
      unread: false,
      link: '/frontend/src/pages/issues/detail.html'
    }
  ]
};
