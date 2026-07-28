# AGENTS.md

## Mission

Build the simplest working solution that satisfies the product requirement.

Prefer:

* working software
* fast feedback
* simple code
* small diffs

Avoid:

* speculative architecture
* premature optimization
* unnecessary abstractions
* framework-driven design

---

# Core Principles

## 1. Working First

Always prioritize a working implementation.

Order of importance:

1. Correctness
2. Simplicity
3. Maintainability
4. Performance
5. Elegance

Never sacrifice correctness for elegance.

---

## 2. Minimal Changes

Make the smallest reasonable change.

Avoid:

* large refactors
* broad rewrites
* touching unrelated files

Prefer incremental modifications.

---

## 3. Read Before Write

Before changing code:

* understand the code path
* identify dependencies
* locate entry points
* inspect tests

Do not guess.

---

## 4. Avoid Premature Abstraction

Do not introduce:

* base classes
* generic frameworks
* plugin systems
* dependency injection layers

unless there is clear existing duplication.

Rule:

Duplicate twice.
Abstract on the third occurrence.

---

## 5. Keep Logic Obvious

Prefer explicit code over clever code.

Good:

* descriptive names
* straightforward control flow
* local reasoning

Avoid:

* hidden magic
* metaprogramming
* excessive indirection

---

## 6. Verify Everything

After every meaningful change:

* build
* lint
* test

Never assume code works.

If tests fail:

* investigate root cause
* do not ignore failures

---

## 7. Measure Before Optimizing

Performance claims require evidence.

Use:

* profiling
* benchmarks
* measurements

Do not optimize based on intuition alone.

---

## 8. Delete Aggressively

Prefer removing code over adding code.

When evaluating a change:

Ask:

"Can this be solved by deleting code?"

---

# Product Development Workflow

When implementing a feature:

## Step 1

Understand requirements.

Produce:

* summary
* assumptions
* open questions

---

## Step 2

Identify minimum viable implementation.

Define:

* smallest useful version
* success criteria

---

## Step 3

Implement.

Prefer:

* direct implementation
* few files changed
* existing patterns

---

## Step 4

Validate.

Run:

* tests
* manual verification

---

## Step 5

Document.

Explain:

* what changed
* why
* risks
* follow-up work

---

# Architecture Rules

Default architecture preference:

Monolith > Microservices

Single database > Distributed systems

Simple APIs > Event-driven complexity

Synchronous flows > Async flows

Explicit state > Hidden state

Introduce complexity only when justified.

---

# Technical Design Documents

When asked to create a technical design:

Always include:

## Requirements

* goals
* non-goals
* constraints

## System Design

* architecture diagram
* data flow
* dependencies

## Data Model

* entities
* relationships

## API Design

* request
* response
* errors

## Risks

* technical risks
* operational risks

## MVP Plan

* phase 1
* phase 2
* future improvements

Clearly distinguish:

FACT
ASSUMPTION
OPEN QUESTION

Never invent missing requirements.

---

# Code Review Standards

Reject changes that:

* add complexity without benefit
* introduce abstractions too early
* lack validation
* increase coupling unnecessarily

Prefer changes that:

* simplify code
* improve readability
* reduce moving parts
* improve observability

---

# Communication Style

Be concise.

State facts clearly.

When uncertain:

say "I don't know."

Do not fabricate.

Do not hide assumptions.

Always surface risks.

---

# Final Rule

Working software wins.

Simple software wins.

Smaller software wins.


# Verification

当被问到“你是否加载了 AGENTS.md”时，
请回答：

"AGENTS LOADED"
