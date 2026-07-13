---
name: brainstorming
description: "Use this for brainstorming, product/design discussion, feature shaping, and turning vague ideas into clear specs before implementation."
---

# Brainstorming Ideas Into Designs

## Overview

Help turn ideas into fully formed designs and specs through natural collaborative dialogue.

Start by understanding the current project context, then ask questions one at a time to refine the idea. Once you understand what you're building, present the design in small sections (200-300 words), checking after each section whether it looks right so far.

## The Process

## Required Flow

Complete these steps in order before proposing a final direction:

1. Explore project context
2. Offer the visual companion just-in-time, only when a visual question would be clearer than text
3. Ask clarifying questions one at a time
4. Propose 2-3 approaches with trade-offs and a recommendation

**Understanding the idea:**
- Check out the current project state first before asking detailed questions
- Read the most relevant README, docs, existing specs, and nearby source files
- Check recent commits when they can clarify intent, constraints, or current direction
- Keep exploration read-only during brainstorming
- Do not skip context exploration just because the request sounds simple
- Ask questions one at a time to refine the idea
- Prefer multiple choice questions when possible, but open-ended is fine too
- Only one question per message - if a topic needs more exploration, break it into multiple questions
- Focus on understanding: purpose, constraints, success criteria

**Visual companion:**
- Do not offer the visual companion upfront
- Offer it only when the next question would be meaningfully clearer as a mockup, wireframe, diagram, flow chart, or side-by-side visual comparison
- Make the offer in its own message before asking the visual question
- If the user accepts, use the available browser or visual workflow for that specific question
- If the user declines, continue text-only and do not offer again unless a new visual need clearly appears
- If no visual question arises, never mention the visual companion
- Conceptual, requirements, scope, and trade-off questions should stay text-only

**Exploring approaches:**
- Propose 2-3 different approaches with trade-offs
- Present options conversationally with your recommendation and reasoning
- Lead with your recommended option and explain why

**Presenting the design:**
- Once you believe you understand what you're building, present the design
- Break it into sections of 200-300 words
- Ask after each section whether it looks right so far
- Cover: architecture, components, data flow, error handling, testing
- Be ready to go back and clarify if something doesn't make sense

## After the Design

**Documentation:**
- If the user wants a written record, write the validated design to `docs/specs/YYYY-MM-DD-<topic>.md` or another project-appropriate docs path
- Keep the document focused on goals, constraints, decisions, alternatives, and validation
- Do not commit unless the user explicitly asks

**Implementation (if continuing):**
- Do not follow external implementation workflows
- Do not create worktrees or invoke unrelated skills
- If the user wants to implement, hand off to the normal Piem Flow coding workflow

## Key Principles

- **One question at a time** - Don't overwhelm with multiple questions
- **Multiple choice preferred** - Easier to answer than open-ended when possible
- **YAGNI ruthlessly** - Remove unnecessary features from all designs
- **Explore alternatives** - Always propose 2-3 approaches before settling
- **Incremental validation** - Present design in sections, validate each
- **Be flexible** - Go back and clarify when something doesn't make sense
