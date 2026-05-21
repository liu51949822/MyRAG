CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    filename varchar(500) NOT NULL,
    path varchar(1000) NOT NULL,
    mime_type varchar(100) NOT NULL,
    page_count integer NOT NULL,
    size_bytes integer NOT NULL,
    ingested_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);

CREATE TABLE IF NOT EXISTS chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content text NOT NULL,
    chunk_index integer NOT NULL,
    embedding vector(1536),
    metadata jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title varchar(500) NOT NULL DEFAULT 'New Session',
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role varchar(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);

CREATE TABLE IF NOT EXISTS code_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_path varchar(1000) NOT NULL,
    language varchar(50) NOT NULL,
    summary text NOT NULL,
    business_logic jsonb NOT NULL,
    technical_impl jsonb NOT NULL,
    architecture jsonb NOT NULL,
    beginner_doc text NOT NULL,
    review_result jsonb,
    analyzed_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_code_analyses_project ON code_analyses(project_path);

CREATE TABLE IF NOT EXISTS body_analyses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type varchar(20) NOT NULL CHECK (source_type IN ('photo', 'video')),
    source_path varchar(1000) NOT NULL,
    posture_score integer NOT NULL,
    posture_deviations jsonb NOT NULL,
    posture_angles jsonb NOT NULL,
    body_type varchar(50) NOT NULL,
    body_type_subtype varchar(100) NOT NULL,
    body_measurements jsonb NOT NULL,
    body_proportions jsonb NOT NULL,
    recommendations jsonb NOT NULL,
    exercise_plan jsonb NOT NULL,
    lifestyle jsonb NOT NULL,
    full_report text NOT NULL,
    analyzed_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_body_analyses_type ON body_analyses(source_type);
