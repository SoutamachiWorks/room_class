# PROJECT INSTRUCTION DOCUMENT

- For Frontend documentation, YOU MUST READ instruction\fe-instruction.md
- After update code, YOU MUST UPDATE TODO AND CHECK. IF NEED, LEAVE THE NOTE

---

## Tech Stack

| Layer              | Technology                      |
|--------------------|---------------------------------|
| Framework          | Next.js                         |
| Database           | MongoDB                         |
| Development Method | KISS (Keep It Simple and Stupid)|

---

## System Overview

Build a multi-role web application with **3 separate dashboards**:
- **Admin Dashboard** — Account management
- **Teacher Dashboard** — Assignment, Material, and Exam management
- **Student Dashboard** — Assignment submission, Material viewing, and Exam taking

---

## Role & Permission Matrix

| Module       | Admin | Teacher                        | Student                          |
|--------------|-------|--------------------------------|----------------------------------|
| Accounts     | CRUD  | —                              | —                                |
| Class Codes  | CRUD  | —                              | —                                |
| Subjects     | CRUD  | —                              | —                                |
| Assignment   | —     | Create, Edit, Delete           | Submit (text + file), Edit, Delete submission |
| Material     | —     | Create, Edit, Delete           | View, Download                   |
| Exam         | —     | Create, Save (draft), Publish, Edit, Delete | Take exam (when published)  |

---

## Core Modules (Teacher & Student)

### 1. Assignment Module

**Teacher side:**
- Create an assignment with:
  - A text input box (description/instructions)
  - Multi-file upload
- Edit and delete assignments

**Student side:**
- Submit an assignment response with:
  - A text input box
  - Multi-file upload
- Edit and delete their own submission

---

### 2. Material Module

**Teacher side:**
- Create a material entry with:
  - A text input box
  - Multi-file upload
- Edit and delete materials

**Student side:**
- View material text and attached files
- Download attached files (read-only, no submission)

---

### 3. Exam Module

**Teacher side — Exam Builder:**
- Works similarly to Google Forms
- Teachers create questions in individual question blocks
- Each question block supports **3 question types** (all optional per block):
  1. **Multiple Choice** — always rendered at the top of the block
  2. **Essay** — rendered below multiple choice
  3. **File Upload** — rendered at the bottom

- Question block hierarchy per question (top to bottom):
  ```
  [Multiple Choice] → [Essay] → [File Upload]
  ```
  Each type within a block is optional; a block can have any combination.

- **Randomization mechanism:**
  - Teacher sets total questions created (e.g., 20) and a display count (e.g., 10)
  - When a student opens the exam, questions are randomly selected and shuffled
  - **Constraint:** `random display count` must NOT exceed `total questions created`
  - If `randomCount >= totalQuestions`, all questions are shown but still shuffled

- **Save vs Publish:**
  - **Save** → stores the exam in the database as a draft; NOT visible to students
  - **Publish** → makes the exam visible and accessible to students

- Teacher can also Edit and Delete exam forms

**Student side — Exam Taking:**
- Exams are visible in the Exam section only after the teacher publishes them
- Students can start an exam and submit answers
- **Tab-switch / exit detection:**
  - If a student exits or switches tabs **2 times**, they are **locked out** of the exam session
  - A locked-out student must retake the exam from the beginning (a new session)

---

## Dashboard Specifications

### Admin Dashboard

**Account Management:**

Create Teacher account with fields:
```
- Teacher ID (No. Induk Guru)
- Full Name
- Username
- Password
- Email
- Phone Number
```

Create Student account with fields:
```
- Student ID (No. Induk Siswa)
- Full Name
- Username
- Password
- Email
- Phone Number
- Class Code
```

**Class Code Management:**
- Add, update, and delete class codes

**Subject Management:**
- Link a subject to a teacher and a class using this format:
  ```
  [Teacher ID] → [Subject Name] → [Class Code]
  ```
- A teacher can be linked to multiple subjects, each with its own class

# NOTE:
Material Section, Exam Section, Assignment Section, mengikuti Subject Management, jadi ketika guru meng upload tugas, materi atau publish ujian, target yang ditentukan sesuai dengan kode kelas - sehingga yang dapat menerima hanya kode kelas yang sudah di pilih guru. maka sebab itu pada saat publish exam, assigment dan material section, akan ada pilihan dari guru itu > punya mata pelajaran apa saja dan mata pelajaran ini mau di publish ke kelas apa.

**Other Admin Functions:**
- View system activity logs
- Update account status (active / inactive)
- Delete accounts

---

### Teacher Dashboard

#### Assignment Section
- Upload (create) assignment — text + multi-file
- Edit assignment
- Delete assignment

#### Material Section
- Upload (create) material — text + multi-file
- Edit material
- Delete material

#### Exam Section
- Create exam form (question builder)
- Edit exam form
- Save exam form (draft — not visible to students)
- Publish exam form (visible to students)
- Delete exam form

---

### Student Dashboard

#### Assignment Section
- Submit assignment — text input + multi-file upload
- Edit submission
- Delete submission

#### Material Section
- View material content
- Download attached files

#### Exam Section
- View published exams
- Take exam (questions displayed based on randomization settings)

---

## Database Mapping

```
Teacher
 ├── Subject A → Class 1A
 ├── Subject B → Class 2B
 └── Subject C → Class 1A
```

- A teacher can handle **multiple subjects**
- Each subject is linked to **one class**
- This mapping is managed by the Admin and must be **fully synchronized** across all related collections

---

## MongoDB Schema Reference

```
collections:
  - users          { role: 'admin' | 'teacher' | 'student', ...profileFields }
  - classCodes     { code, label }
  - subjects       { teacherId, subjectName, classCode }
  - assignments    { teacherId, subjectId, text, files[], createdAt }
  - submissions    { assignmentId, studentId, text, files[], submittedAt }
  - materials      { teacherId, subjectId, text, files[], createdAt }
  - exams          { teacherId, subjectId, status: 'draft'|'published', questions[], randomCount }
  - examSessions   { examId, studentId, exitCount, answers[], startedAt, submittedAt }
```

---

## ⚠ MANDATORY REQUIREMENTS

1. **Data synchronization is critical.** When a subject is created or updated by Admin (Teacher ID + Subject Name + Class Code), all related entities (assignments, materials, exams, sessions) must correctly reference the updated mapping.
2. All file uploads must support **multi-file** (array of file references).
3. Exam randomization logic must be enforced server-side — never trust client input for question selection.
4. Exam session exit-lock must be tracked server-side per `examId + studentId`.
5. Apply strict **role-based access control (RBAC)** on every API route — never expose teacher or admin endpoints to student roles and vice versa.
