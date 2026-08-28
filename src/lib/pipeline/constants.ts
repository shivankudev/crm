/**
 * §4 Lead Lifecycle also lists NOT_INTERESTED/INVALID/DUPLICATE as
 * terminal exits reachable "from any stage" — those are dead-ends, not
 * pipeline progress, so the kanban board (unlike the full status list)
 * leaves them off its columns. WON/LOST stay as the board's two closing
 * columns, matching how sales pipelines conventionally visualize outcomes.
 */
export const PIPELINE_EXCLUDED_STATUSES = ["NOT_INTERESTED", "INVALID", "DUPLICATE"];

/** Cards rendered per column before the board switches to "N of Total — open the list for the rest". */
export const PIPELINE_COLUMN_CARD_LIMIT = 30;
