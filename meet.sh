#!/bin/bash

set -e

# Colors for messages
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Global flags (can be set via environment or arguments)
SKIP_INSTALL=${SKIP_INSTALL:-false}
SKIP_BUILD=${SKIP_BUILD:-false}
SKIP_TYPINGS=${SKIP_TYPINGS:-false}
BASE_HREF=${BASE_HREF:-/}

# Function to check if pnpm is installed
check_pnpm() {
  if ! command -v pnpm >/dev/null 2>&1; then
    printf "${RED}Error: pnpm is not installed.${NC}\n"
    printf "${YELLOW}pnpm is required to run this script.${NC}\n\n"
    printf "Would you like to install pnpm globally? (y/n): "
    read REPLY
    case "$REPLY" in
      [Yy]*)
        printf "${BLUE}Installing pnpm globally (requires sudo)...${NC}\n"
        if sudo npm install -g pnpm; then
          printf "${GREEN}pnpm installed successfully!${NC}\n"
        else
          printf "${RED}Failed to install pnpm. Please install it manually.${NC}\n"
          exit 1
        fi
        ;;
      *)
        printf "${YELLOW}pnpm installation cancelled. Please install it manually and try again.${NC}\n"
        exit 1
        ;;
    esac
  fi
}


# Parse global flags from arguments
parse_global_flags() {
  SKIP_INSTALL=false
  SKIP_BUILD=false
  SKIP_TYPINGS=false
  BASE_HREF="/"

  while [ $# -gt 0 ]; do
    case "$1" in
      --skip-install)
        SKIP_INSTALL=true
        ;;
      --skip-build)
        SKIP_BUILD=true
        ;;
      --skip-typings)
        SKIP_TYPINGS=true
        ;;
      --base-href)
        shift
        BASE_HREF="$1"
        ;;
      --base-href=*)
        BASE_HREF="${1#*=}"
        ;;
      *)
        # Unknown argument, ignore
        ;;
    esac
    shift
  done
}


# Function to display help
show_help() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}   JMeet - Build Script${NC}"
  echo -e "${BLUE}=====================================${NC}"
  echo
  echo -e "${GREEN}Usage:${NC} ./meet.sh [command] [options]"
  echo
  echo -e "${GREEN}Global Options (can be used with any command):${NC}"
  echo -e "  ${YELLOW}--skip-install${NC}    Skip dependency installation (useful in CI)"
  echo -e "  ${YELLOW}--skip-build${NC}      Skip build steps (for testing only)"
  echo -e "  ${YELLOW}--skip-typings${NC}    Skip typings build (when already built)"
  echo -e "  ${YELLOW}--base-href <path>${NC} Set base href for frontend build (default: /)"
  echo
  echo -e "${GREEN}Commands:${NC}"
  echo
  echo -e "  ${BLUE}install${NC}"
  echo "    Install all dependencies (pnpm install)"
  echo
  echo -e "  ${BLUE}build${NC}"
  echo "    Build all project components (typings, shared-components, backend, frontend)"
  echo
  echo -e "  ${BLUE}build-typings${NC}"
  echo "    Build only the shared typings"
  echo
  echo -e "  ${BLUE}test-unit-backend${NC}"
  echo "    Run unit tests for the backend project"
  echo
  echo -e "  ${BLUE}test-unit-frontend${NC}"
  echo "    Run unit tests for the frontend shared-meet-components library (Karma, headless Chrome)"
  echo
  echo -e "  ${BLUE}test-e2e-frontend${NC}"
  echo "    Run end-to-end tests for the frontend project (Playwright 'spa' project)"
  echo -e "    ${YELLOW}Options:${NC} --force-install-browsers    Force reinstall of Playwright browsers"
  echo -e "             ${NC} --skip-install-browsers     Skip Playwright browsers installation"
  echo
  echo -e "  ${BLUE}dev${NC}"
  echo "    Start development mode with watchers"
  echo
  echo -e "  ${BLUE}start${NC}"
  echo "    Start JMeet in production or CI mode"
  echo -e "    ${YELLOW}Options:${NC} --prod    Start in production mode"
  echo -e "            ${NC} --ci      Start in CI mode"
  echo
  echo -e "  ${BLUE}build-rest-api-doc${NC} [output_dir]"
  echo "    Generate REST API documentation"
  echo
  echo -e "  ${BLUE}build-docker${NC} <image-name> [--demos]"
  echo "    Build Docker image (use --demos for demo deployment)"
  echo
  echo -e "  ${BLUE}help${NC}"
  echo "    Show this help message"
  echo
}

# Install dependencies
install_dependencies() {
  if [ "$SKIP_INSTALL" = true ]; then
    echo -e "${YELLOW}Skipping dependency installation (--skip-install flag)${NC}"
    return 0
  fi

  check_pnpm
  echo -e "${BLUE}Installing dependencies...${NC}"
  pnpm install --frozen-lockfile
}

# Build typings
build_typings() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}   Building Typings${NC}"
  echo -e "${BLUE}=====================================${NC}"
  echo
  install_dependencies
  pnpm run build:typings
  echo -e "${GREEN}✓ Typings built successfully!${NC}"
}

# Build entire project
build_project() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}   Building JMeet${NC}"
  echo -e "${BLUE}=====================================${NC}"
  echo

  install_dependencies
  echo

  echo -e "${GREEN}Building all components...${NC}"
  export BASE_HREF
  pnpm run build

  echo
  echo -e "${GREEN}✓ Build completed successfully!${NC}"
}

# Run unit tests for backend
test_unit_backend() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}   Running Backend Unit Tests${NC}"
  echo -e "${BLUE}=====================================${NC}"
  echo

  install_dependencies

  echo -e "${GREEN}Running backend unit tests...${NC}"
  pnpm run test:unit-backend
}

# Run unit tests for the frontend shared-meet-components library (Karma)
test_unit_frontend() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}   Running Frontend Library Unit Tests${NC}"
  echo -e "${BLUE}=====================================${NC}"
  echo

  install_dependencies
  # The library imports @openvidu-meet/typings, which is not path-mapped to source,
  # so its built output must exist before Karma compiles the specs.
  build_typings

  # Karma needs a Chrome/Chromium binary. Honor an explicit CHROME_BIN or a
  # system Chrome; otherwise fall back to the Playwright-managed Chromium so the
  # runner needs nothing preinstalled.
  if [ -z "$CHROME_BIN" ] \
    && ! command -v google-chrome >/dev/null 2>&1 \
    && ! command -v google-chrome-stable >/dev/null 2>&1 \
    && ! command -v chromium >/dev/null 2>&1 \
    && ! command -v chromium-browser >/dev/null 2>&1; then
    ensure_playwright_chromium false false
    PW_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/tmp/ms-playwright}
    CHROME_BIN="$(PLAYWRIGHT_BROWSERS_PATH="$PW_BROWSERS_PATH" node -e 'console.log(require("playwright-core").chromium.executablePath())')"
    export CHROME_BIN
    echo -e "${YELLOW}Using Playwright Chromium for Karma: ${CHROME_BIN}${NC}"
  fi

  echo -e "${GREEN}Running frontend library unit tests...${NC}"
  pnpm run test:unit-frontend
}

# Ensure Playwright Chromium browser is installed in a shared cache
ensure_playwright_chromium() {
  local force_install="$1"
  local skip_install_browsers="$2"

  if [ "$skip_install_browsers" = true ]; then
    echo -e "${YELLOW}Skipping Playwright browsers installation (--skip-install-browsers flag).${NC}"
    return 0
  fi

  echo -e "${GREEN}Preparing Playwright browsers (chromium)...${NC}"
  PW_BROWSERS_PATH=${PLAYWRIGHT_BROWSERS_PATH:-/tmp/ms-playwright}
  mkdir -p "$PW_BROWSERS_PATH"

  MARKER_FILE="$PW_BROWSERS_PATH/.playwright_chromium_installed"

  local force_arg=""
  if [ "$force_install" = true ]; then
    echo -e "${YELLOW}Force install requested. Reinstalling Playwright browsers (chromium).${NC}"
    force_arg="--force"
  fi

  echo -e "${GREEN}Installing Playwright browsers (chromium)...${NC}"
  # Use a single deterministic CLI path to avoid version-resolution discrepancies.
  PLAYWRIGHT_BROWSERS_PATH="$PW_BROWSERS_PATH" node ./node_modules/@playwright/test/cli.js install --with-deps chromium $force_arg
  PLAYWRIGHT_VER=$(PLAYWRIGHT_BROWSERS_PATH="$PW_BROWSERS_PATH" node ./node_modules/@playwright/test/cli.js --version 2>/dev/null || true)

  echo "installed_at=$(date --iso-8601=seconds)" > "$MARKER_FILE" || true
  echo "playwright_version=$PLAYWRIGHT_VER" >> "$MARKER_FILE" || true
}

# Run migrated e2e tests for frontend
test_e2e_frontend() {
  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}   Running Frontend E2E Components Tests${NC}"
  echo -e "${BLUE}=====================================${NC}"
  echo

  # Parse optional flags
  FORCE_INSTALL=false
  SKIP_INSTALL_BROWSERS=false
  for arg in "$@"; do
    case "$arg" in
      --force-install-browsers|--force-install|-f)
        FORCE_INSTALL=true
        ;;
      --skip-install-browsers)
        SKIP_INSTALL_BROWSERS=true
        ;;
    esac
  done

  install_dependencies

  ensure_playwright_chromium "$FORCE_INSTALL" "$SKIP_INSTALL_BROWSERS"

  echo -e "${GREEN}Running frontend E2E tests...${NC}"
  pnpm --filter @openvidu-meet/frontend run e2e:playwright:spa
}

# Helper: Add common commands (typings, docs)
add_common_dev_commands() {
  # Typings watcher. It generates the typings-ready.flag file when done for other watchers to wait on.
  CMD_NAMES+=("typings")
  CMD_COLORS+=("bgGreen.black")
  CMD_COMMANDS+=("./scripts/dev/watch-typings.sh ce")

  # shared-meet-components watcher
  CMD_NAMES+=("shared-meet-components")
  CMD_COLORS+=("bgYellow.dark")
  CMD_COMMANDS+=("pnpm --filter @openvidu-meet/frontend run lib:serve")

}

# Helper: Add CE-specific commands (backend, frontend)
add_ce_commands() {
  local shared_meet_components_path="$1"

  # REST API docs watcher
  CMD_NAMES+=("rest-api-docs")
  CMD_COLORS+=("bgGray")
  CMD_COMMANDS+=("pnpm run dev:rest-api-docs")

  # Run backend
  CMD_NAMES+=("backend")
  CMD_COLORS+=("cyan")
  CMD_COMMANDS+=("node ./scripts/dev/watch-with-typings-guard.mjs 'pnpm run dev:backend'")

  # Run frontend after shared-meet-components is ready
  CMD_NAMES+=("frontend")
  CMD_COLORS+=("magenta")
  CMD_COMMANDS+=("wait-on ${shared_meet_components_path} && sleep 1 && node ./scripts/dev/watch-with-typings-guard.mjs 'pnpm run dev:frontend'")
}

# Helper: Launch all development watchers using concurrently
launch_dev_watchers() {
  local shared_meet_components_path="$1"

  echo -e "${YELLOW}⏳ Launching all development watchers...${NC}"
  echo -e "${BLUE}Processes: ${#CMD_NAMES[@]}${NC}"
  echo

  # Clean up shared-meet-components package.json to ensure wait-on works
  rm -rf "${shared_meet_components_path}"

  # Build concurrently arguments from arrays
  local names_arg=$(IFS=,; echo "${CMD_NAMES[*]}")
  local colors_arg=$(IFS=,; echo "${CMD_COLORS[*]}")

  # Execute all commands concurrently
  pnpm exec concurrently -k \
    --names "$names_arg" \
    --prefix-colors "$colors_arg" \
    "${CMD_COMMANDS[@]}"
}

# Start development mode with watchers
dev() {
  echo -e "${BLUE}=============================================${NC}"
  echo -e "${BLUE}  🚀 Starting JMeet in dev mode...${NC}"
  echo -e "${BLUE}=============================================${NC}"
  echo

  install_dependencies

  # Define paths
  local shared_meet_components_path="meet-ce/frontend/projects/shared-meet-components/dist/package.json"

  # Initialize command arrays
  CMD_NAMES=()
  CMD_COLORS=()
  CMD_COMMANDS=()

  # Add common commands (typings, shared-meet-components)
  add_common_dev_commands

  # Add backend/frontend commands
  add_ce_commands "$shared_meet_components_path"

  # Launch all watchers
  launch_dev_watchers "$shared_meet_components_path"
}

# Start JMeet services in prod or ci mode
start() {
  MODE=""
  for arg in "$@"; do
    case "$arg" in
      --prod)
        MODE="prod" ;;
      --ci)
        MODE="ci" ;;
    esac
  done

  if [ -z "$MODE" ]; then
    echo -e "${RED}Error: start command requires --prod or --ci option${NC}"
    echo -e "${YELLOW}Usage: ./meet.sh start --prod  or  ./meet.sh start --ci${NC}"
    exit 1
  fi

  if [ "$SKIP_BUILD" != true ]; then
    echo -e "${BLUE}Building backend...${NC}"
    install_dependencies
    pnpm run build:typings
    pnpm run build:backend
  fi

  # Run from the backend directory so dotenv resolves '.env.test' / '.env.dev'
  # relative to it (matches the previous 'pnpm --filter ... run start' behavior).
  case "$MODE" in
    prod)
      echo -e "${BLUE}Starting in production mode...${NC}"
      cd meet-ce/backend && NODE_ENV=production node dist/src/server.js
      ;;
    ci)
      echo -e "${BLUE}Starting in CI mode...${NC}"
      cd meet-ce/backend && NODE_ENV=ci node dist/src/server.js
      ;;
  esac
}

# Build REST API documentation
build_rest_api_doc() {
  local output_target="$1"
  CE_REST_API_DOC_PATH="meet-ce/backend/public/openapi/"

  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}   Building REST API Docs${NC}"
  echo -e "${BLUE}=====================================${NC}"
  echo

  check_pnpm

  # Solo instalar si no existen dependencias locales del backend
  if [ ! -d "node_modules" ] || [ ! -d "meet-ce/backend/node_modules" ]; then
    echo -e "${YELLOW}Backend dependencies not found. Installing minimal backend deps...${NC}"
    pnpm --filter @openvidu-meet/backend install
  else
    echo -e "${GREEN}Backend dependencies already present. Skipping install.${NC}"
  fi

  echo -e "${GREEN}Generating REST API documentation...${NC}"
  pnpm run build:rest-api-docs

  # Determinar si el parámetro es archivo o directorio
  local output_dir output_file
  if [[ "$output_target" =~ \.html$ ]]; then
    output_dir=$(dirname "$output_target")
    output_file="$output_target"
  else
    output_dir="${output_target%/}"
    output_file="$output_dir/public.html"
  fi

  # Crear carpeta contenedora si no existe
  if [ ! -d "$output_dir" ]; then
    echo -e "${YELLOW}Creating output directory: $output_dir${NC}"
    mkdir -p "$output_dir"
  fi

  # Preguntar si el archivo ya existe
  if [ -f "$output_file" ]; then
    echo -e "${YELLOW}Warning: '$output_file' already exists.${NC}"
    read -rp "Do you want to overwrite it? [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      echo -e "${RED}Operation cancelled by user.${NC}"
      exit 1
    fi
  fi

  # Copiar documentación
  if [ -f "$CE_REST_API_DOC_PATH/public.html" ]; then
    echo -e "${GREEN}Copying REST API documentation to: $output_file${NC}"
    cp "$CE_REST_API_DOC_PATH/public.html" "$output_file"
    echo -e "${GREEN}✓ Documentation copied successfully!${NC}"
  else
    echo -e "${RED}Error: REST API documentation files not found${NC}"
    exit 1
  fi

  echo
  echo -e "${GREEN}✓ REST API documentation generated successfully!${NC}"
  echo -e "${YELLOW}Output file: $(cd "$(dirname "$output_file")" && pwd)/$(basename "$output_file")${NC}"
}

# Build Docker image
build_docker() {
  local image_name="$1"
  shift || true  # Remove first argument (image name)

  # Validate arguments
  if [ -z "$image_name" ]; then
    echo -e "${RED}Error: You need to specify an image name${NC}"
    echo -e "${YELLOW}Usage: ./meet.sh build-docker <image-name> [--demos]${NC}"
    exit 1
  fi

  # Parse flags
  local is_demos=false

  while [ $# -gt 0 ]; do
    case "$1" in
      --demos)
        is_demos=true
        shift
        ;;
      *)
        # ignore unknown flags for forward compatibility
        shift
        ;;
    esac
  done

  # Prepare metadata
  local final_image_name="$image_name"
  local base_href="/"
  if [ "$is_demos" = true ]; then
    final_image_name="${image_name}-demos"
    base_href="/openvidu-meet/"
    echo -e "${GREEN}Building demos image: $final_image_name${NC}"
  else
    echo -e "${GREEN}Building production image: $final_image_name${NC}"
  fi

  echo -e "${BLUE}=====================================${NC}"
  echo -e "${BLUE}   Building Docker Image${NC}"
  echo -e "${BLUE}=====================================${NC}"
  echo

  echo -e "${GREEN}Using BASE_HREF: $base_href${NC}"

  export BUILDKIT_PROGRESS=plain
  if docker build --pull --no-cache --rm=true -f meet-ce/docker/Dockerfile -t "$final_image_name" --build-arg BASE_HREF="$base_href" .; then
    echo
    echo -e "${GREEN}✓ Docker image '$final_image_name' built successfully!${NC}"
  else
    echo
    echo -e "${RED}✗ Failed to build Docker image '$final_image_name'${NC}"
    exit 1
  fi


}

# Main script logic
main() {
  if [ $# -eq 0 ]; then
    echo -e "${YELLOW}No command specified.${NC}"
    echo
    show_help
    exit 1
  fi

  command="$1"
  shift

  # Parse global flags
  parse_global_flags "$@"

  case "$command" in
    install)
      SKIP_INSTALL=false  # Force install even if flag was set
      install_dependencies
      ;;
    build)
      build_project
      ;;
    build-typings)
      SKIP_TYPINGS=false  # Force build typings
      build_typings
      ;;
    test-unit-backend)
      test_unit_backend
      ;;
    test-unit-frontend)
      test_unit_frontend
      ;;
    test-e2e-frontend)
      test_e2e_frontend "$@"
      ;;
    dev)
      dev
      ;;
    start)
      start "$@"
      ;;
    build-rest-api-doc)
      build_rest_api_doc "$1"
      ;;
    build-docker)
      build_docker "$@"
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      echo -e "${RED}Error: Unknown command '$command'${NC}"
      echo
      show_help
      exit 1
      ;;
  esac
}

# Run main function with all arguments
main "$@"
