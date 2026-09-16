/**
 * CodePath curriculum data.
 *
 * Every topic links to YouTube *search* results (topic + a top channel) instead
 * of a hard-coded video id, so links never rot when a creator re-uploads,
 * renames or deletes a video.
 *
 * Topic shape:
 *   t  - title
 *   d  - one-line description of what to learn
 *   q  - base YouTube search query (the best channel is appended at runtime)
 *   ch - recommended channels, best first (the first is used for the main link)
 *   f  - optional list of features/functions to build (used by the projects)
 */
(function (root) {
  'use strict';

  var SECTIONS = [
    {
      id: 'programming',
      no: 1,
      title: 'Programming',
      icon: '💻',
      color: '#818cf8',
      blurb: 'Start here. Language basics every beginner must own before DSA.',
      topics: [
        {
          t: 'Roadmap: How to Start Coding',
          d: 'Pick one language and finish the basics before jumping around.',
          q: 'how to start coding for beginners complete roadmap',
          ch: ['CodeWithHarry', 'Apna College', 'freeCodeCamp.org']
        },
        {
          t: 'Variables & Data Types',
          d: 'int, float, char, boolean, string + type casting and scope.',
          q: 'variables and data types explained for beginners',
          ch: ['CodeWithHarry', 'Programming with Mosh', 'Bro Code']
        },
        {
          t: 'Input / Output',
          d: 'Reading user input from console and printing formatted output.',
          q: 'input and output in programming for beginners',
          ch: ['CodeWithHarry', 'Neso Academy', 'Bro Code']
        },
        {
          t: 'Operators',
          d: 'Arithmetic, relational, logical, bitwise, ternary — with precedence.',
          q: 'operators in programming explained with examples',
          ch: ['CodeWithHarry', 'Neso Academy', 'Telusko']
        },
        {
          t: 'If-Else & Switch',
          d: 'Branching, nested conditions, switch-case and clean decision making.',
          q: 'if else and switch case tutorial for beginners',
          ch: ['Apna College', 'Programming with Mosh', 'Bro Code']
        },
        {
          t: 'Loops (for, while, do-while)',
          d: 'Iteration, break/continue and pattern printing practice.',
          q: 'loops in programming for while do while explained',
          ch: ['CodeWithHarry', 'Apna College', 'Bro Code']
        },
        {
          t: 'Functions / Methods',
          d: 'Parameters, return values, overloading, scope and recursion intro.',
          q: 'functions and methods explained for beginners',
          ch: ['Programming with Mosh', 'CodeWithHarry', 'Bro Code']
        },
        {
          t: 'Arrays (1D & 2D)',
          d: 'Storing lists of values, indexing, traversal and 2D matrices.',
          q: 'arrays in programming explained for beginners',
          ch: ['CodeWithHarry', 'Neso Academy', 'Bro Code']
        },
        {
          t: 'Strings',
          d: 'Immutability, string methods, StringBuilder and common operations.',
          q: 'strings in programming complete tutorial',
          ch: ['Apna College', 'Neso Academy', 'Bro Code']
        },
        {
          t: 'Recursion (basics)',
          d: 'Base case, recursive case, call stack and how to trace a recursion.',
          q: 'recursion explained for beginners step by step',
          ch: ['Abdul Bari', 'Apna College', 'freeCodeCamp.org']
        },
        {
          t: 'OOP: Class & Object',
          d: 'Blueprints vs instances, constructors, this/self and memory layout.',
          q: 'class and object in object oriented programming explained',
          ch: ['CodeBeauty', 'Telusko', 'Programming with Mosh']
        },
        {
          t: 'Inheritance',
          d: 'extends, super, constructor chaining, types of inheritance.',
          q: 'inheritance in oop explained with example',
          ch: ['CodeBeauty', 'Telusko', 'Kunal Kushwaha']
        },
        {
          t: 'Polymorphism',
          d: 'Compile-time (overloading) vs runtime (overriding) + dynamic dispatch.',
          q: 'polymorphism in oop explained overloading vs overriding',
          ch: ['CodeBeauty', 'Telusko', 'Kunal Kushwaha']
        },
        {
          t: 'Encapsulation',
          d: 'Access modifiers, getters/setters and why data hiding matters.',
          q: 'encapsulation in oop explained with example',
          ch: ['CodeBeauty', 'Telusko', 'Programming with Mosh']
        },
        {
          t: 'Abstraction',
          d: 'Abstract classes vs interfaces — when to use which.',
          q: 'abstraction in oop abstract class vs interface',
          ch: ['CodeBeauty', 'Telusko', 'Programming with Mosh']
        },
        {
          t: 'Exception Handling',
          d: 'try/catch/finally, throw, checked vs unchecked, custom exceptions.',
          q: 'exception handling try catch finally explained',
          ch: ['Telusko', 'CodeWithHarry', 'Programming with Mosh']
        },
        {
          t: 'Collections / STL / Generics',
          d: 'List, Set, Map, ArrayList, HashMap, generics and iterators.',
          q: 'collections framework explained for beginners',
          ch: ['Telusko', 'Kunal Kushwaha', 'CodeWithHarry']
        }
      ]
    },

    {
      id: 'dsa',
      no: 2,
      title: 'DSA',
      icon: '🧮',
      color: '#34d399',
      blurb: 'Data structures & algorithms — the part that gets you interviews.',
      topics: [
        {
          t: 'Time & Space Complexity (Big-O)',
          d: 'Count operations, compare growth rates, amortized analysis.',
          q: 'time and space complexity big o notation explained',
          ch: ['Abdul Bari', 'Striver', 'freeCodeCamp.org']
        },
        {
          t: 'Array (DSA patterns)',
          d: 'Two pointers, prefix sums, sliding window, Kadane, in-place tricks.',
          q: 'array problems techniques two pointers sliding window',
          ch: ['Striver', 'NeetCode', 'Abdul Bari']
        },
        {
          t: 'String (DSA patterns)',
          d: 'Anagrams, palindromes, pattern matching, KMP basics.',
          q: 'string algorithms and problems for interviews',
          ch: ['Striver', 'NeetCode', 'Apna College']
        },
        {
          t: 'Linked List',
          d: 'Singly/doubly/circular, reversal, cycle detection, merge & middle.',
          q: 'linked list complete tutorial with problems',
          ch: ['Striver', 'Abdul Bari', 'Kunal Kushwaha']
        },
        {
          t: 'Stack',
          d: 'LIFO, array/linked implementation, balanced brackets, monotonic stack.',
          q: 'stack data structure explained with implementation',
          ch: ['Striver', 'Abdul Bari', 'Kunal Kushwaha']
        },
        {
          t: 'Queue & Deque',
          d: 'FIFO, circular queue, priority queue and sliding-window maximum.',
          q: 'queue and deque data structure explained',
          ch: ['Striver', 'Abdul Bari', 'Kunal Kushwaha']
        },
        {
          t: 'HashMap / HashSet',
          d: 'Hashing, collisions, load factor and the most asked interview patterns.',
          q: 'hashmap and hashset explained with problems',
          ch: ['Striver', 'Kunal Kushwaha', 'Abdul Bari']
        },
        {
          t: 'Sorting Algorithms',
          d: 'Bubble, selection, insertion, merge, quick, counting — with complexity.',
          q: 'sorting algorithms explained merge sort quick sort',
          ch: ['Abdul Bari', 'Striver', 'Michael Sambol']
        },
        {
          t: 'Searching (Linear & Binary)',
          d: 'Linear scan, sorted search and the cost of each approach.',
          q: 'linear search and binary search explained',
          ch: ['Abdul Bari', 'Striver', 'NeetCode']
        },
        {
          t: 'Binary Search (patterns)',
          d: 'On answer, rotated arrays, first/last occurrence, bounds.',
          q: 'binary search on answer advanced patterns',
          ch: ['Striver', 'NeetCode', 'Aditya Verma']
        },
        {
          t: 'Tree & Binary Tree',
          d: 'Traversals (in/pre/post/level), height, diameter, LCA.',
          q: 'binary tree traversal and problems explained',
          ch: ['Striver', 'Abdul Bari', 'Kunal Kushwaha']
        },
        {
          t: 'Binary Search Tree (BST)',
          d: 'Insert, delete, search, validate BST, inorder = sorted.',
          q: 'binary search tree operations explained',
          ch: ['Striver', 'Abdul Bari', 'NeetCode']
        },
        {
          t: 'Heap / Priority Queue',
          d: 'Min-max heap, heapify, heap sort, top-K problems.',
          q: 'heap data structure priority queue explained',
          ch: ['Striver', 'Abdul Bari', 'NeetCode']
        },
        {
          t: 'Graph',
          d: 'BFS, DFS, cycle detection, topological sort, shortest paths, MST.',
          q: 'graph algorithms bfs dfs shortest path complete',
          ch: ['Striver', 'William Fiset', 'Abdul Bari']
        },
        {
          t: 'Greedy',
          d: 'Activity selection, intervals, Huffman, exchange-argument intuition.',
          q: 'greedy algorithm explained with problems',
          ch: ['Striver', 'Abdul Bari', 'Kunal Kushwaha']
        },
        {
          t: 'Dynamic Programming',
          d: 'Memoization, tabulation, knapsack, LIS, LCS, DP on grids.',
          q: 'dynamic programming complete playlist for beginners',
          ch: ['Striver', 'Aditya Verma', 'Abdul Bari']
        },
        {
          t: 'DSA Practice Plan & Sheets',
          d: 'A 60-90 day plan with a curated question sheet per topic.',
          q: 'dsa practice plan question sheet placement preparation',
          ch: ['Striver', 'Apna College', 'CodeHelp - by Babbar']
        }
      ]
    },

    {
      id: 'web',
      no: 3,
      title: 'Web Development',
      icon: '🌐',
      color: '#38bdf8',
      blurb: 'HTML to React — build things people can actually open in a browser.',
      topics: [
        {
          t: 'How the Web Works',
          d: 'Client, server, DNS, HTTP methods, status codes, browser rendering.',
          q: 'how the web works http basics explained',
          ch: ['Fireship', 'Traversy Media', 'Web Dev Simplified']
        },
        {
          t: 'HTML',
          d: 'Semantic tags, forms, tables, media, accessibility and SEO basics.',
          q: 'html full course for beginners',
          ch: ['SuperSimpleDev', 'Apna College', 'Traversy Media']
        },
        {
          t: 'CSS',
          d: 'Box model, flexbox, grid, responsive design, animations, variables.',
          q: 'css full course flexbox grid responsive',
          ch: ['SuperSimpleDev', 'Kevin Powell', 'Apna College']
        },
        {
          t: 'JavaScript',
          d: 'let/const, functions, arrays, objects, scope, classes, modules.',
          q: 'javascript full course for beginners',
          ch: ['CodeWithHarry', 'SuperSimpleDev', 'Bro Code']
        },
        {
          t: 'JavaScript DOM & Events',
          d: 'querySelector, event listeners, delegation, createElement, form validation.',
          q: 'javascript dom manipulation and events tutorial',
          ch: ['Web Dev Simplified', 'Bro Code', 'The Net Ninja']
        },
        {
          t: 'Async JS: Promises & async/await',
          d: 'Event loop, callbacks, promises, async/await, fetch, error handling.',
          q: 'javascript async await promises event loop explained',
          ch: ['Web Dev Simplified', 'Fireship', 'The Net Ninja']
        },
        {
          t: 'React',
          d: 'Components, props, state, hooks, routing, forms, API calls.',
          q: 'react js full course hooks and projects',
          ch: ['CodeWithHarry', 'The Net Ninja', 'PedroTech']
        },
        {
          t: 'REST API',
          d: 'Resources, endpoints, verbs, status codes, pagination, versioning.',
          q: 'rest api explained and how to build one',
          ch: ['Traversy Media', 'Web Dev Simplified', 'Amigoscode']
        },
        {
          t: 'JSON',
          d: 'Syntax, nested data, parse/stringify and JSON vs XML.',
          q: 'json explained for beginners',
          ch: ['Traversy Media', 'Web Dev Simplified', 'Fireship']
        },
        {
          t: 'Authentication',
          d: 'Sessions, cookies, JWT, hashing passwords, OAuth login.',
          q: 'authentication jwt vs session cookies explained',
          ch: ['Web Dev Simplified', 'Amigoscode', 'Fireship']
        },
        {
          t: 'Deploy a Website',
          d: 'Build, environment variables, Vercel/Netlify, custom domain, HTTPS.',
          q: 'deploy website free vercel netlify step by step',
          ch: ['Traversy Media', 'Fireship', 'Web Dev Simplified']
        }
      ]
    },

    {
      id: 'backend',
      no: 4,
      title: 'Backend (Java)',
      icon: '☕',
      color: '#fbbf24',
      blurb: 'Java + Spring Boot — the stack most service companies hire for.',
      topics: [
        {
          t: 'Java Core',
          d: 'JDK setup, syntax, loops, arrays, strings, methods, packages.',
          q: 'java full course for beginners',
          ch: ['Telusko', 'CodeWithHarry', 'Programming with Mosh']
        },
        {
          t: 'Java OOP Deep Dive',
          d: 'Classes, inheritance, interfaces, enums, records, inner classes.',
          q: 'java oop concepts complete tutorial',
          ch: ['Telusko', 'Kunal Kushwaha', 'CodeWithHarry']
        },
        {
          t: 'Java Collections Framework',
          d: 'List, Set, Map, Queue + which implementation to pick and why.',
          q: 'java collections framework complete tutorial',
          ch: ['Telusko', 'Kunal Kushwaha', 'Coding with John']
        },
        {
          t: 'Java 8+ Features',
          d: 'Lambdas, streams, Optional, method references, functional interfaces.',
          q: 'java 8 streams lambda expressions tutorial',
          ch: ['Telusko', 'Amigoscode', 'Coding with John']
        },
        {
          t: 'Multithreading & Concurrency',
          d: 'Threads, synchronized, executors, CompletableFuture, race conditions.',
          q: 'java multithreading and concurrency tutorial',
          ch: ['Telusko', 'Coding with John', 'Defog Tech']
        },
        {
          t: 'JDBC',
          d: 'Drivers, Connection, PreparedStatement, ResultSet, transactions.',
          q: 'jdbc java database connectivity tutorial',
          ch: ['Telusko', 'Learn Coding', 'Naresh IT']
        },
        {
          t: 'Maven / Gradle',
          d: 'pom.xml, dependencies, build lifecycle, plugins, multi-module.',
          q: 'maven tutorial for beginners spring boot',
          ch: ['Telusko', 'Amigoscode', 'Bouali Ali']
        },
        {
          t: 'Spring Core (IoC & DI)',
          d: 'Beans, application context, constructor/setter injection, scopes.',
          q: 'spring core ioc dependency injection tutorial',
          ch: ['Telusko', 'Amigoscode', 'Java Brains']
        },
        {
          t: 'Spring Boot',
          d: 'Starters, auto-configuration, application.properties, profiles, Actuator.',
          q: 'spring boot full course for beginners',
          ch: ['Amigoscode', 'Telusko', 'Daily Code Buffer']
        },
        {
          t: 'Spring MVC & REST Controllers',
          d: '@RestController, @GetMapping, @RequestBody, validation, exception handler.',
          q: 'spring boot rest api controllers tutorial',
          ch: ['Bouali Ali', 'Amigoscode', 'Telusko']
        },
        {
          t: 'Hibernate / Spring Data JPA',
          d: 'Entities, relationships, JPQL, repositories, pagination, N+1 problem.',
          q: 'spring data jpa hibernate tutorial',
          ch: ['Amigoscode', 'Bouali Ali', 'Telusko']
        },
        {
          t: 'Spring Security + JWT',
          d: 'Filter chain, password encoding, roles, JWT login and refresh tokens.',
          q: 'spring security jwt authentication tutorial',
          ch: ['Amigoscode', 'Bouali Ali', 'Daily Code Buffer']
        },
        {
          t: 'Testing (JUnit & Mockito)',
          d: 'Unit tests, assertions, mocks, integration tests with MockMvc.',
          q: 'junit and mockito testing spring boot tutorial',
          ch: ['Amigoscode', 'Telusko', 'Bouali Ali']
        },
        {
          t: 'Backend Project: Production REST API',
          d: 'Layered architecture, DTOs, validation, Swagger, Docker, deploy.',
          q: 'spring boot project rest api complete build',
          ch: ['Amigoscode', 'Bouali Ali', 'Coding Shuttle']
        }
      ]
    },

    {
      id: 'database',
      no: 5,
      title: 'Database',
      icon: '🗄️',
      color: '#e879f9',
      blurb: 'SQL you can actually write, plus the DBMS theory for interviews.',
      topics: [
        {
          t: 'SQL Basics',
          d: 'SELECT, WHERE, ORDER BY, LIMIT, DISTINCT, NULL handling.',
          q: 'sql full course for beginners select where',
          ch: ['Alex The Analyst', 'CodeWithHarry', 'Caleb Curry']
        },
        {
          t: 'SQL Joins',
          d: 'INNER, LEFT, RIGHT, FULL, SELF and CROSS joins with examples.',
          q: 'sql joins explained inner left right full join',
          ch: ['Alex The Analyst', 'Caleb Curry', 'Learn Coding']
        },
        {
          t: 'Aggregations & Subqueries',
          d: 'GROUP BY, HAVING, COUNT/SUM/AVG, CTEs, window functions.',
          q: 'sql group by having subqueries window functions',
          ch: ['Alex The Analyst', 'techTFQ', 'Caleb Curry']
        },
        {
          t: 'MySQL / PostgreSQL Hands-on',
          d: 'Install, create schema, users, backup/restore, connect from Java.',
          q: 'mysql postgresql tutorial create database tables',
          ch: ['CodeWithHarry', 'Alex The Analyst', 'techTFQ']
        },
        {
          t: 'DBMS Concepts',
          d: 'Data models, keys, constraints, relational algebra, architecture.',
          q: 'dbms full course for beginners',
          ch: ['Gate Smashers', 'Knowledge Gate', "Jenny's Lectures CS IT"]
        },
        {
          t: 'ER Model & Schema Design',
          d: 'Entities, relationships, cardinality, converting ER to tables.',
          q: 'er model and er diagram in dbms explained',
          ch: ['Gate Smashers', 'Knowledge Gate', 'Neso Academy']
        },
        {
          t: 'Normalization (1NF to BCNF)',
          d: 'Functional dependency, candidate keys, decomposition, anomalies.',
          q: 'normalization in dbms 1nf 2nf 3nf bcnf explained',
          ch: ['Gate Smashers', "Jenny's Lectures CS IT", 'Knowledge Gate']
        },
        {
          t: 'Indexing',
          d: 'B+ trees, clustered vs non-clustered, when an index is not used.',
          q: 'indexing in dbms b tree clustered index explained',
          ch: ['Gate Smashers', "Jenny's Lectures CS IT", 'techTFQ']
        },
        {
          t: 'Transactions & ACID',
          d: 'ACID, schedules, serializability, locking, deadlock.',
          q: 'transactions and acid properties in dbms',
          ch: ['Gate Smashers', 'Knowledge Gate', "Jenny's Lectures CS IT"]
        },
        {
          t: 'NoSQL (MongoDB)',
          d: 'Documents, collections, when NoSQL beats SQL, aggregation pipeline.',
          q: 'mongodb nosql database tutorial for beginners',
          ch: ['Fireship', 'Amigoscode', 'Traversy Media']
        },
        {
          t: 'SQL Interview Practice',
          d: 'Top asked queries: nth highest salary, duplicates, running totals.',
          q: 'sql interview questions and answers practice',
          ch: ['techTFQ', 'Ankit Bansal', 'Alex The Analyst']
        }
      ]
    },

    {
      id: 'cs',
      no: 6,
      title: 'CS Fundamentals',
      icon: '🧠',
      color: '#fb7185',
      blurb: 'OS, networks and software engineering — the written-round favourites.',
      topics: [
        {
          t: 'Operating System',
          d: 'Types of OS, kernel, system calls, user vs kernel mode.',
          q: 'operating system full course for beginners',
          ch: ['Gate Smashers', 'Knowledge Gate', 'Neso Academy']
        },
        {
          t: 'OS: Process, Thread & Scheduling',
          d: 'PCB, context switch, FCFS/SJF/RR, synchronization, deadlock.',
          q: 'process scheduling and deadlock in operating system',
          ch: ['Gate Smashers', 'Knowledge Gate', "Jenny's Lectures CS IT"]
        },
        {
          t: 'Computer Networks',
          d: 'OSI vs TCP/IP, devices, topologies, subnetting basics.',
          q: 'computer networks full course for beginners',
          ch: ['Gate Smashers', 'Knowledge Gate', 'Neso Academy']
        },
        {
          t: 'Networking: HTTP, DNS, TCP',
          d: 'Handshakes, ports, HTTPS, DNS resolution, what really happens on a URL hit.',
          q: 'http dns tcp ip explained how internet works',
          ch: ['Hussein Nasser', 'Gate Smashers', 'Neso Academy']
        },
        {
          t: 'DBMS (Revision)',
          d: 'Rapid revision of keys, normalization, transactions for placement tests.',
          q: 'dbms revision one shot placement',
          ch: ['Gate Smashers', 'Knowledge Gate', 'Neso Academy']
        },
        {
          t: 'OOP (Interview Revision)',
          d: 'The 4 pillars, abstract vs interface, SOLID principles.',
          q: 'oop concepts interview questions solid principles',
          ch: ['CodeBeauty', 'Telusko', 'Kunal Kushwaha']
        },
        {
          t: 'Software Engineering & SDLC',
          d: 'Waterfall vs Agile, testing types, UML, versioning, code review.',
          q: 'software engineering sdlc agile explained',
          ch: ['Gate Smashers', 'Knowledge Gate', 'Edureka']
        },
        {
          t: 'System Design Basics',
          d: 'Scaling, caching, load balancers, databases, CAP theorem.',
          q: 'system design basics for beginners caching load balancer',
          ch: ['Gaurav Sen', 'ByteByteGo', 'CodeKarle']
        }
      ]
    },

    {
      id: 'tools',
      no: 7,
      title: 'Tools',
      icon: '🛠️',
      color: '#a78bfa',
      blurb: 'The everyday toolbelt: version control, terminal, containers, cloud.',
      topics: [
        {
          t: 'Git',
          d: 'init, add, commit, branch, merge, rebase, stash, conflict resolution.',
          q: 'git and github full course for beginners',
          ch: ['Kunal Kushwaha', 'Apna College', 'The Net Ninja']
        },
        {
          t: 'GitHub',
          d: 'Pull requests, forks, issues, code review, Actions, Pages.',
          q: 'github pull request workflow tutorial',
          ch: ['Kunal Kushwaha', 'The Net Ninja', 'Fireship']
        },
        {
          t: 'Linux Basics',
          d: 'File system, permissions, pipes, grep, SSH, process & package management.',
          q: 'linux command line basics for beginners',
          ch: ['Kunal Kushwaha', 'TechWorld with Nana', 'NetworkChuck']
        },
        {
          t: 'Docker Basics',
          d: 'Images, containers, Dockerfile, volumes, ports, registries.',
          q: 'docker tutorial for beginners containers images',
          ch: ['TechWorld with Nana', 'Fireship', 'Kunal Kushwaha']
        },
        {
          t: 'Docker Compose',
          d: 'Multi-container apps: app + database + reverse proxy with one command.',
          q: 'docker compose tutorial multi container app',
          ch: ['TechWorld with Nana', 'Amigoscode', 'Fireship']
        },
        {
          t: 'Cloud Basics',
          d: 'IaaS/PaaS, regions, IAM, S3, EC2, deploy a backend for free.',
          q: 'cloud computing aws basics for beginners',
          ch: ['TechWorld with Nana', 'freeCodeCamp.org', 'Fireship']
        },
        {
          t: 'CI/CD Basics',
          d: 'Pipeline stages, build/test/deploy, GitHub Actions, secrets.',
          q: 'ci cd pipeline github actions tutorial',
          ch: ['TechWorld with Nana', 'Fireship', 'Amigoscode']
        },
        {
          t: 'Editor Setup & Productivity',
          d: 'VS Code shortcuts, extensions, debugging, formatting, snippets.',
          q: 'vs code setup tips extensions for developers',
          ch: ['CodeWithHarry', 'Fireship', 'Web Dev Simplified']
        }
      ]
    },

    {
      id: 'projects',
      no: 8,
      title: 'Projects',
      icon: '🚀',
      color: '#fb923c',
      blurb: 'Build at least 3 strong projects — each one lists every function to ship.',
      topics: [
        {
          t: 'Project 1: E-commerce App (Full Stack)',
          d: 'The classic full-stack portfolio project: React front end + Spring Boot API + SQL.',
          q: 'e commerce website full stack project build with source code',
          ch: ['CodeWithHarry', 'Bouali Ali', 'Coding Shuttle'],
          f: [
            'Product catalog with search, category filters and sorting',
            'Product details page with image gallery and stock status',
            'Cart: add / update quantity / remove / persist between visits',
            'Wishlist and recently viewed products',
            'User auth: register, login, JWT, forgot password, role-based access',
            'Checkout: address book, shipping options, order summary, tax/total',
            'Payments in test mode (Stripe or Razorpay sandbox)',
            'Order history, order tracking status and invoice download',
            'Reviews and ratings with average score',
            'Admin panel: product CRUD, image upload, stock, orders, users',
            'Responsive UI, product skeleton loaders, empty/error states',
            'Deployed API + DB with environment variables and daily backups'
          ]
        },
        {
          t: 'Project 2: Real-time Chat Application',
          d: 'Sockets, auth and persistence — the project that teaches how messaging works.',
          q: 'real time chat application project websocket socket io',
          ch: ['CodeWithHarry', 'Traversy Media', 'Bouali Ali'],
          f: [
            'Auth with unique usernames and profile avatars',
            '1-to-1 chats plus group chats with admin rights',
            'Real-time delivery over WebSocket (Socket.IO or STOMP)',
            'Online / offline presence and last-seen time',
            'Typing indicator and read receipts (sent / delivered / read)',
            'Image, file and emoji sharing with size limits',
            'Message search, edit, delete and reply-to threads',
            'Unread badge counters and browser notifications',
            'Chat history persisted in the database, paginated',
            'Create group, add/remove members, leave group',
            'Block/report a user and basic profanity handling',
            'Mobile-friendly layout with auto-scroll and day separators'
          ]
        },
        {
          t: 'Project 3: Job / College Management System',
          d: 'A CRUD-heavy admin system — exactly what campus placements ask you to build.',
          q: 'college management system project java spring boot source code',
          ch: ['Learn Coding', 'CodeWithHarry', 'Bouali Ali'],
          f: [
            'Separate logins for student, faculty and admin roles',
            'Student records: add / edit / delete / search / bulk CSV import',
            'Attendance module with daily marking and percentage reports',
            'Marks and results: internal, external, grade calculation, marksheet',
            'Timetable and class scheduling with conflict detection',
            'Notices / announcements with attachments and expiry dates',
            'Job portal: post openings, apply, upload resume, application status',
            'Placement dashboard: eligible students, companies, offers',
            'Fee management: dues, receipts, pending list, payment history',
            'Search, filters and pagination on every table',
            'Reports exported to CSV and PDF, plus simple charts',
            'Dashboard analytics: counts, trends, today-at-a-glance cards'
          ]
        },
        {
          t: 'Project 4: Expense Tracker',
          d: 'Small but complete: auth, CRUD, charts and exports in a week.',
          q: 'expense tracker app project tutorial react',
          ch: ['Web Dev Simplified', 'CodeWithHarry', 'Traversy Media'],
          f: [
            'Add, edit and delete income / expense entries',
            'Categories and custom category creation',
            'Monthly budget with alert when you cross 80%',
            'Charts: category split and 6-month trend',
            'Search by date range, category and amount',
            'Export to CSV and PDF statement',
            'Multi-account support and running balance',
            'Dark mode and fully responsive layout'
          ]
        },
        {
          t: 'Project 5: Notes / Task Manager',
          d: 'Productivity app that proves you can handle state and offline data.',
          q: 'notes app project tutorial with local storage',
          ch: ['Web Dev Simplified', 'The Net Ninja', 'Traversy Media'],
          f: [
            'Rich text notes with markdown preview',
            'Tags, colour labels, pin and archive',
            'Full-text search and sort by date / title',
            'Task lists with due dates, reminders and streaks',
            'Drag-and-drop reordering of notes and checklist items',
            'Offline-first with localStorage and background sync',
            'Trash with restore and permanent delete',
            'Export/import all notes as JSON backup'
          ]
        },
        {
          t: 'Project 6: URL Shortener + Analytics',
          d: 'A backend-first project about redirects, caching and click tracking.',
          q: 'url shortener project system design implementation',
          ch: ['TechWorld with Nana', 'Bouali Ali', 'Fireship'],
          f: [
            'Shorten any URL and auto-generate a unique code',
            'Custom alias with validation and reserved-word checks',
            'Fast redirect endpoint with caching',
            'Click tracking: count, timestamp, referrer, device, country',
            'Per-link analytics dashboard with charts',
            'QR code generation and download',
            'Link expiry, password protection and disable toggle',
            'Rate limiting to stop abuse'
          ]
        }
      ]
    }
  ];

  var APP_DATA = {
    appName: 'CodePath',
    tagline: 'Programming roadmap + the best YouTube videos for every topic',
    version: '1.0.0',
    tip: 'Every link opens YouTube search results for that topic, so it always finds the latest videos.',
    sections: SECTIONS
  };

  root.APP_DATA = APP_DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = APP_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
