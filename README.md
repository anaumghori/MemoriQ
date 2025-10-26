# MemoriQ

### Table of Contents
- [Introduction](#introduction)
- [Features](#features)
- [Architecture](#architecture)
  - [Feature implementation details](feature-implementation-details)
  - [Architecture Diagram](architecture-diagram)
- [Tech Stack](#tech-stack)
- [Setup Instructions](#setup-instructions)
- [Future Improvements](#future-improvements)
- [Gallery](#gallery)

<br></br>


## Introduction

**Problem:** Memory loss affects thousands of people every day. While it is commonly associated with conditions like dementia or Alzheimer’s, there are many other causes that impact people of all ages. Head injuries, strokes, long-term alcohol misuse, seizures, and various forms of amnesia can all lead to temporary or long-term memory challenges. Regardless of the cause or duration, people experiencing memory loss often need consistent, accessible support beyond traditional therapy. Although some digital tools exist to assist them, most fall short of providing a complete, reliable, and privacy-conscious experience. In an age of cloud-based AI applications, users are understandably concerned about sharing personal memories or photos online, especially when such data could be stored on servers or used to train external models. Additionally, many of these tools require constant internet access and complicated login systems, which can make them difficult to use for those who value simplicity or live in low-connectivity areas.

**Solution:** Developed as a proof of concept, MemoriQ is an Android application that supports individuals dealing with memory loss while maintaining their independence and protecting their personal information. It operates completely offline, with no reliance on external or cloud servers, ensuring that all data remains securely stored on the user's device at all times. By running AI models locally, MemoriQ eliminates the need for internet connectivity or user logins, removing common privacy and accessibility barriers while giving users full control over their personal data.

**Important Note on Model Selection:** The choice of AI models used in this project is based on extensive testing to find combinations that work well together for the intended use cases. The models discussed throughout this documentation (LFM2-350M for RAG, embeddinggemma-300m for embeddings, and Qwen3-0.6B for recall/quiz generation) represent the configuration that performed best during development. However, alternative combinations have also shown promising results, including [Llama-3.2-1B.Q5_K_M.gguf](https://huggingface.co/DevQuasar/meta-llama.Llama-3.2-1B-GGUF/blob/main/Llama-3.2-1B.Q5_K_M.gguf) paired with [LFM2-1.2B-Q8_0.gguf](https://huggingface.co/LiquidAI/LFM2-1.2B-GGUF/blob/main/LFM2-1.2B-Q8_0.gguf). It's important to understand that nearly every model combination will have trade-offs and limitations in a production environment. For truly production-ready performance, these models would require fine-tuning on large, domain-specific datasets tailored to memory assistance tasks. If you choose to clone or adapt this repository, please feel free to experiment with different model combinations and select those that best suit your specific requirements, device capabilities, and use cases.


<br></br>


## Features
1. **Comprehensive Memory Notes:** Users can create detailed memory entries that include text, images, audio, and image descriptions, allowing each note to capture the full essence of a moment. This combination of multiple media forms helps preserve memories in a way that feels vivid and complete.

2. **AI-Powered Memory Chat:** As the number of saved notes grows, finding specific details can become difficult or overwhelming. The built-in AI chat simplifies this by allowing users to talk directly with their memories. Instead of searching manually, users can simply ask questions, and the chat retrieves relevant information from their stored notes, making memory retrieval faster, easier, and more natural.

3. **Personalized Memory Quiz:** To encourage active engagement and strengthen recall, MemoriQ generates quiz-style questions with two possible answers directly from the user’s notes, prompting them to choose the correct one. Unlike typical memory games, this approach not only helps improve cognitive recall but does so through meaningful, personal content which helps keep the user connected to their own life and experiences.

4. **Reminiscence Mode:** MemoriQ includes a unique reminiscence feature that transforms saved notes into an immersive, spoken experience. Rather than simply reading notes aloud, the system converts them into a soothing conversational script as if a companion is gently guiding the user through their memories. Each session selects five random notes and allows playback, pausing, or revisiting previous moments, creating a calming space for reflection. The interface for this mode is designed with soft tones and simplicity in mind, fostering a sense of comfort and emotional grounding.

5. **Privacy and Offline Functionality:** Every element of MemoriQ is designed to protect the user’s privacy. A secure local database is created directly on the user’s device, storing all notes, images, and audio files safely without ever leaving their control. After an initial one-time download of AI models from Hugging Face (which requires internet access), the models operate locally for all future sessions. This ensures complete privacy, data ownership, and reliable accessibility without any dependency on servers or logins.


<br></br>


## Architecture

MemoriQ is built on a sophisticated multi-layered architecture that ensures privacy, performance, and seamless user experience. The application follows a modular design pattern where each component has a clearly defined responsibility, from initialization to AI-powered features.

1. **App Context Initialization:** When MemoriQ launches, it begins by initializing the global application context using React's Context API with a reducer pattern. This centralized state manager tracks critical flags including database readiness, model loading status, download progress, and any initialization errors.

2. **Database Setup:** The SQLite database (`memoriq.db`) is created in the app's document directory. The database schema includes tables for notes, tags, images, embeddings, and recall scripts. All relationships are established with proper foreign keys and indexes for optimal query performance.

3. **AI Model Loading:** Three specialized AI models are initialized through the ModelManager singleton:
   - **RAG Model** (LFM2-350M, 273 MB): Finetuned model, powers conversational memory chat with context-aware responses
   - **Embedding Model** (embeddinggemma-300m, 278 MB): Generates 768-dimensional vector embeddings for semantic search
   - **Recall Model** (Qwen3-0.6B, 639 MB): Creates recall scripts and generates quiz questions

4. **Model Download & Caching:** On first launch, models are downloaded from Hugging Face repositories and cached locally. Progress is tracked and displayed to the user. On subsequent launches, the app uses the cached models instantly, requiring no internet connection.

5. **App Gate:** Once both the database and all models are ready, the initialization gate opens, revealing the main application interface. If initialization fails or is incomplete, users see a loading screen with progress indicators and helpful messaging about the app's offline capabilities.


<br></br>


### Feature Implementation Details

**Memory Notes Creation:**
When a user creates a note, the data flows through multiple stages:
1. User inputs are collected (title, content, tags, images with descriptions, optional audio)
2. A database transaction atomically inserts the note, creates/links tags, and stores image references
3. After the transaction succeeds, two background processes begin asynchronously:
   - **Embedding Pipeline:** Text is combined and hashed, embeddings are generated for the note text and each image description, then stored as Float32 arrays converted to binary BLOBs
   - **Recall Script Pipeline:** The recall model generates a comforting script based on the note content, which is saved for later use in reminiscence sessions

These background processes use debouncing (300ms delay) to batch rapid edits and avoid redundant processing.

**AI-Powered Memory Chat:**
The chat feature implements Retrieval-Augmented Generation (RAG), a technique that grounds AI responses in factual data:
1. User asks a question (e.g., "What did I do at the beach?")
2. The query is converted into a 768-dimensional embedding vector
3. This vector is compared against all stored embeddings (both note text and image descriptions) using cosine similarity
4. The top matching notes are retrieved (typically 2-3 notes with similarity scores above 0.5)
5. Retrieved notes are formatted into the system prompt with clear instructions: "Only use information from these notes"
6. The RAG model generates a response using the context, streaming tokens in real-time
7. Tokens are throttled using requestAnimationFrame to ensure smooth UI updates without blocking the main thread

**Personalized Memory Quiz:**
The quiz feature promotes active recall through meaningful engagement:
1. All notes are retrieved and shuffled for variety
2. Five questions are distributed across notes (round-robin if fewer than 5 notes exist)
3. For each question, a prompt is built containing the note's full context (title, content, tags, image descriptions)
4. The recall model generates a multiple-choice question with two options: one correct and one plausible distractor
5. The model returns structured JSON (question text, option A, option B, correct answer)
6. Questions are generated ahead of the user's progress to eliminate waiting time
7. The quiz tracks scoring and provides immediate feedback on each answer
8. A low temperature setting (0.1) ensures consistent, deterministic question generation

**Reminiscence Mode:**
This feature creates a calming, guided experience:
1. A smart selection algorithm scores notes based on multiple factors:
   - Presence of images (increases emotional connection)
   - Age of the memory (older memories prioritized)
   - Content richness (longer, detailed notes score higher)
   - Recency of last reminisce session (ensures variety across sessions)
2. The top 5 scored notes are selected and shuffled for presentation
3. For each note, the pre-generated recall script is displayed with accompanying images
4. Text-to-speech automatically reads the script at a normal speaking rate for natural conversation flow
5. Visual animations (pulsing icon) provide feedback during playback
6. Users can pause, replay, navigate between memories, or end the session at any time
7. Notes are marked with timestamps to influence future session selections


<br></br>


### Architecture Diagram

Below is a visual representation of MemoriQ's architecture, showing the flow from app initialization through feature usage:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          APP INITIALIZATION                             │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   AppContext Provider    │
                    │  (Global State Manager)  │
                    └──────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
         ┌────────────────────┐        ┌────────────────────┐
         │ Database Init      │        │ ModelManager Init  │
         │ (SQLite/expo-sql)  │        │   (llama.rn)       │
         └────────────────────┘        └────────────────────┘
                    │                             │
                    │                  ┌──────────┼──────────┐
                    │                  ▼          ▼          ▼
                    │         ┌─────────────┬─────────────┬─────────────┐
                    │         │ RAG Model   │  Embedding  │   Recall    │
                    │         │ (273 MB)    │   Model     │   Model     │
                    │         │             │  (278 MB)   │  (639 MB)   │
                    │         │ Chat Agent  │  Vectorizer │ Script Gen  │
                    │         └─────────────┴─────────────┴─────────────┘
                    │                             │
                    └──────────────┬──────────────┘
                                   ▼
                         ┌──────────────────┐
                         │    App Gate      │
                         │ (Checks readiness)│
                         └──────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼ IF READY                    ▼ IF NOT READY
         ┌────────────────────┐        ┌────────────────────┐
         │  Main App Screen   │        │  Loading Screen    │
         │   (index.tsx)      │        │  (with progress)   │
         └────────────────────┘        └────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                                 │
└─────────────────────────────────────────────────────────────────────────┘

         ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
         │    notes     │         │     tags     │         │   images     │
         ├──────────────┤         ├──────────────┤         ├──────────────┤
         │ id (PK)      │◄───┐    │ id (PK)      │    ┌───►│ id (PK)      │
         │ title        │    │    │ name (UNIQ)  │    │    │ noteId (FK)  │
         │ content      │    │    └──────────────┘    │    │ uri          │
         │ audioUri     │    │            ▲           │    │ description  │
         │ recallScript │    │            │           │    └──────────────┘
         │ createdAt    │    │    ┌──────────────┐   │            │
         │ updatedAt    │    └────┤  note_tags   │───┘            │
         └──────────────┘         ├──────────────┤                │
                │                 │ noteId (FK)  │                │
                │                 │ tagId (FK)   │                │
                │                 └──────────────┘                │
                │                                                 │
                │                                                 │
        ┌───────┴────────┐                             ┌─────────┴────────┐
        ▼                ▼                             ▼                  ▼
┌─────────────────┐  ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│note_embeddings  │  │ Recall Scripts     │  │image_embeddings  │  │ Image Metadata   │
├─────────────────┤  ├────────────────────┤  ├──────────────────┤  ├──────────────────┤
│ id (PK)         │  │ (stored in notes   │  │ id (PK)          │  │ (stored in images│
│ noteId (FK,UQ)  │  │  table as TEXT)    │  │ imageId (FK,UQ)  │  │  table)          │
│ embedding (BLOB)│  └────────────────────┘  │ description      │  └──────────────────┘
│ dimensions      │                          │ embedding (BLOB) │
│ textHash        │                          │ dimensions       │
│ status          │                          │ descriptionHash  │
│ createdAt       │                          │ status           │
└─────────────────┘                          │ createdAt        │
                                             └──────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                    FEATURE: NOTE CREATION FLOW                          │
└─────────────────────────────────────────────────────────────────────────┘

User Input (newNote.tsx)
    │
    ├─► Title, Content, Tags
    ├─► Images + Descriptions (Camera.tsx)
    └─► Audio Recording (Audio.tsx)
    │
    ▼
┌─────────────────────────┐
│  createNote()           │
│  (notesOperations.ts)   │
└─────────────────────────┘
    │
    ▼ [SQLite Transaction]
┌─────────────────────────────────────┐
│ 1. INSERT into notes table          │
│ 2. INSERT/SELECT tags               │
│ 3. INSERT into note_tags            │
│ 4. INSERT into images table         │
└─────────────────────────────────────┘
    │
    ▼ [Async Background]
┌──────────────┬──────────────────────────┐
▼              ▼                          ▼
[Embedding]  [Image Embeddings]    [Recall Script]
    │              │                      │
    ▼              ▼                      ▼
Combine text   For each image:     Build prompt with
+ hash         - hash description  note content
    │              │                      │
    ▼              ▼                      ▼
Call           Call                Call
Embedding      Embedding           Recall Model
Model          Model               (Qwen3)
    │              │                      │
    ▼              ▼                      ▼
Store BLOB     Store BLOB          Store script in
in note_       in image_           notes.recall-
embeddings     embeddings          Script column
    │              │                      │
    └──────────────┴──────────────────────┘
                   ▼
           Note fully processed
           (ready for retrieval)

┌─────────────────────────────────────────────────────────────────────────┐
│                 FEATURE: AI-POWERED MEMORY CHAT (RAG)                   │
└─────────────────────────────────────────────────────────────────────────┘

User Query: "What did I do at the beach?"
    │
    ▼
┌───────────────────────────────┐
│ generateQueryEmbedding()      │
│ (createQueryEmbedding.ts)     │
└───────────────────────────────┘
    │
    ▼ [Embedding Model]
Query → 768-dim vector
    │
    ▼
┌───────────────────────────────────────────────┐
│ retrieveRelevantNotes()                       │
│ (retrieveRelevantNotes.ts)                    │
├───────────────────────────────────────────────┤
│ 1. Fetch all note_embeddings                  │
│ 2. Fetch all image_embeddings                 │
│ 3. For each embedding:                        │
│    - Convert BLOB → Float32Array              │
│    - Calculate cosine similarity with query   │
│    - Filter by threshold (0.5)                │
│ 4. Sort by similarity (descending)            │
│ 5. Apply relative threshold (75% of top)      │
│ 6. Take top K notes (default: 2)              │
│ 7. Fetch full note details from DB            │
└───────────────────────────────────────────────┘
    │
    ▼
Retrieved Notes (with similarity scores)
    │
    ▼
┌───────────────────────────────┐
│ buildSystemPrompt()           │
│ (buildPrompts.ts)             │
├───────────────────────────────┤
│ System Prompt Structure:      │
│ ├─ Role: Memory companion     │
│ ├─ Instructions: Use only     │
│ │  provided notes             │
│ ├─ Context: Retrieved notes   │
│ │  (title, content, tags,     │
│ │   image descriptions)       │
│ └─ Tone: Warm, supportive     │
└───────────────────────────────┘
    │
    ▼
┌───────────────────────────────┐
│ RAG Model Completion          │
│ (ragContext.completion())     │
├───────────────────────────────┤
│ Messages:                     │
│ [0] system: <prompt + context>│
│ [1] user: <original query>    │
│                               │
│ Parameters:                   │
│ - n_predict: 512              │
│ - temperature: 0.5            │
│ - top_p: 0.9                  │
│ - streaming: true             │
└───────────────────────────────┘
    │
    ▼ [Token Stream]
┌───────────────────────────────┐
│ Streaming Handler             │
│ - Accumulate tokens           │
│ - Throttle with rAF           │
│ - Update UI incrementally     │
└───────────────────────────────┘
    │
    ▼
Display answer in chat bubble

┌─────────────────────────────────────────────────────────────────────────┐
│                   FEATURE: PERSONALIZED MEMORY QUIZ                     │
└─────────────────────────────────────────────────────────────────────────┘

Quiz Start (quiz.tsx)
    │
    ▼
┌───────────────────────────────┐
│ 1. getAllNotes()              │
│ 2. Shuffle notes array        │
│ 3. Assign 5 questions across  │
│    notes (round-robin)        │
└───────────────────────────────┘
    │
    ▼
For each question (1-5):
    │
    ▼
┌───────────────────────────────┐
│ buildQuizPrompt()             │
│ (buildPrompts.ts)             │
├───────────────────────────────┤
│ Include:                      │
│ - Note title                  │
│ - Note content                │
│ - Tags                        │
│ - Image descriptions          │
│                               │
│ Instructions:                 │
│ - Create 1 multiple-choice    │
│ - 2 options (A/B)             │
│ - 1 correct, 1 plausible      │
│ - Return JSON format          │
└───────────────────────────────┘
    │
    ▼
┌───────────────────────────────┐
│ Recall Model Completion       │
│ (recallContext.completion())  │
├───────────────────────────────┤
│ Parameters:                   │
│ - temperature: 0.1 (low)      │
│ - max_tokens: 400             │
│ - Deterministic output        │
└───────────────────────────────┘
    │
    ▼
Parse JSON Response:
{
  "question": "...",
  "optionA": "...",
  "optionB": "...",
  "correct": "A" or "B"
}
    │
    ▼
┌───────────────────────────────┐
│ Display Question              │
│ - Show question text          │
│ - Two answer buttons          │
│ - Track user selection        │
│ - Show feedback (✓/✗)         │
│ - Update score                │
└───────────────────────────────┘
    │
    ▼
Next question (repeat loop)
    │
    ▼
Final score screen

┌─────────────────────────────────────────────────────────────────────────┐
│                      FEATURE: REMINISCENCE MODE                         │
└─────────────────────────────────────────────────────────────────────────┘

Session Start (reminisce.tsx)
    │
    ▼
┌────────────────────────────────────────┐
│ selectReminisceNotes()                 │
│ (selectReminisceNotes.ts)              │
├────────────────────────────────────────┤
│ Scoring Algorithm:                     │
│ score = (hasImages ? 50 : 0)           │
│       + (ageInDays * 0.5)              │
│       + (contentLength * 0.01)         │
│       + (daysSinceLastShown * 2)       │
│       + (hasRecallScript ? 10 : -100)  │
│                                        │
│ 1. Calculate score for each note       │
│ 2. Sort by score (descending)          │
│ 3. Take top 5                          │
│ 4. Shuffle for variety                 │
│ 5. Filter: must have recallScript      │
└────────────────────────────────────────┘
    │
    ▼
Selected 5 notes with scripts
    │
    ▼
For each note:
    │
    ▼
┌────────────────────────────────────────┐
│ Display UI                             │
│ ├─ Image (if exists)                   │
│ ├─ OR animated speaking icon           │
│ ├─ Note title                          │
│ └─ Recall script in styled card        │
└────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────┐
│ expo-speech.speak()                    │
│ (Text-to-Speech)                       │
├────────────────────────────────────────┤
│ Parameters:                            │
│ - language: "en-US"                    │
│ - rate: 1.0 (normal speaking rate)     │
│ - pitch: 1.0                           │
│                                        │
│ Callbacks:                             │
│ - onStart: Animate icon (pulse)        │
│ - onDone: Auto-advance after 2s        │
│ - onError: Handle gracefully           │
└────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────┐
│ User Controls                          │
│ ├─ Play/Pause                          │
│ ├─ Replay                              │
│ ├─ Previous/Next                       │
│ └─ End Session                         │
└────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────┐
│ markNotesAsShown()                     │
│ - Update lastShownInReminisce timestamp│
│ - Affects future session selection     │
└────────────────────────────────────────┘
    │
    ▼
Session complete screen

┌─────────────────────────────────────────────────────────────────────────┐
│                     MODEL INTEGRATION (llama.rn)                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   RAG Model     │      │ Embedding Model │      │  Recall Model   │
│   (LFM2-350M)   │      │ (gemma-300m)    │      │  (Qwen3-0.6B)   │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        │ initLlama({            │ initLlama({            │ initLlama({
        │   n_ctx: 2048,         │   n_ctx: 512,          │   n_ctx: 2048,
        │   n_gpu_layers: 0,     │   embedding: true,     │   n_gpu_layers: 0,
        │   use_mlock: true      │   use_mlock: true      │   use_mlock: true
        │ })                     │ })                     │ })
        │                        │                        │
        ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ LlamaContext    │      │ LlamaContext    │      │ LlamaContext    │
│ (RAG)           │      │ (Embedding)     │      │ (Recall)        │
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        ├─► completion()         ├─► embedding()          ├─► completion()
        │   - Chat responses     │   - Note vectors       │   - Quiz questions
        │   - Streaming          │   - Query vectors      │   - Recall scripts
        │                        │   - Image vectors      │
        │                        │                        │
        └────────────────────────┴────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   App Features         │
                    │  (Use via ModelManager)│
                    └────────────────────────┘

```

<br></br>

## Tech Stack

1. **Expo and React Native:** MemoriQ is built using Expo and React Native, providing a seamless development environment optimized for Android. This combination enables a responsive and intuitive mobile experience while maintaining efficient performance and clean, modular code.

2. **[Llama.rn Integration:](https://github.com/mybigday/llama.rn)** The application leverages Llama.rn, a React Native binding for llama.cpp to run AI models locally on the device. Through this framework, models are downloaded from Hugging Face during initial setup and then used directly within the app, powering chat interactions, quizzes, and reminiscence features. 

3. **Custom Model Training using unsloth:** To ensure that each feature operates optimally, MemoriQ employs task-specific RAG model that was fine-tuned using Unsloth. This approach allows for precise performance across different components. 

<br></br>


## Setup Instructions

1. **Clone the Repository**
   ```bash
   git clone https://github.com/anaumghori/MemoriQ.git
   cd MemoriQ
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build Development Client with EAS**
   ```bash
   eas build -p android --profile preview
   ```

4. **Start Development Server**
   ```bash
   $env:EXPO_PACKAGER_PROXY_URL="http://localhost:8081"; npx expo start --dev-client
   ```

   *Note: You can also replace `localhost:8081` with your local machine's IP address*

5. **Alternative: Run with Expo**
   ```bash
   npm run android
   ```

<br></br>


## Future Improvements
While MemoriQ successfully demonstrates the core concept of an offline, privacy-focused memory assistance application, several enhancements would significantly improve the user experience and functionality:

1. **Multi-Turn Conversation Support:** Currently, the chat feature does not persist conversation history in the database. Each user query is treated as an independent interaction, which limits the ability to have multi-turn conversations. A future implementation would save chat sessions and message history, allowing the AI to reference previous exchanges and maintain conversational context throughout a session.

2. **Optimized Model Selection:** The current implementation allows flexibility in model choices, which is valuable for experimentation but may lead to inconsistent performance across different devices and use cases. Future versions will focus on identifying and fine-tuning a fixed set of models that deliver reliable, consistent performance for all users. 

3. **Audio Model Integration:** While the reminiscence feature currently uses text-to-speech (TTS) API by expo to read recall scripts, integrating a dedicated audio generation model would significantly enhance the emotional quality and naturalness of the assistant's voice. 

4. **Customizable Quiz Length:** The quiz feature is currently fixed at 5 questions per session. Future updates will allow users to select their preferred number of questions (e.g., 3, 5, 10, or 15), providing flexibility for different time commitments and engagement levels. 

Beyond these specific improvements, MemoriQ as a proof of concept demonstrates significant potential for expansion. With continued development and refinement, MemoriQ could evolve from a promising prototype into a robust, widely-accessible tool that genuinely improves quality of life for people dealing with memory loss.

<br></br>

## Gallery

### Quiz Page
<img width="2400" height="1100" alt="quiz page" src="https://github.com/user-attachments/assets/ed88a07a-fda5-42e4-8c38-9956f5d10ca1" />  

### Chat Page
<img width="1200" height="550" alt="chat page" src="https://github.com/user-attachments/assets/87ea6a4a-c5d5-4bb0-81cf-bfacb4ab7d21" />  

### Notes Page
<img width="1200" height="550" alt="notes page" src="https://github.com/user-attachments/assets/9d5bbfbb-d91f-4bc9-ab26-28e209163ae7" />