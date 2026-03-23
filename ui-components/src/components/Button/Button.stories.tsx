import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const ChevronRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const meta: Meta<typeof Button> = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "destructive"],
      description: "Visual style variant",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Button size",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
    children: {
      control: "text",
      description: "Button label",
    },
  },
  args: {
    children: "Button",
    variant: "primary",
    size: "md",
    disabled: false,
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// ── Primary ──────────────────────────────────────────────────────────────

export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Primary Button",
  },
};

export const PrimarySmall: Story = {
  args: { variant: "primary", size: "sm", children: "Small" },
};

export const PrimaryLarge: Story = {
  args: { variant: "primary", size: "lg", children: "Large" },
};

export const PrimaryDisabled: Story = {
  args: { variant: "primary", children: "Disabled", disabled: true },
};

// ── Secondary ────────────────────────────────────────────────────────────

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary Button",
  },
};

export const SecondarySmall: Story = {
  args: { variant: "secondary", size: "sm", children: "Small" },
};

export const SecondaryLarge: Story = {
  args: { variant: "secondary", size: "lg", children: "Large" },
};

export const SecondaryDisabled: Story = {
  args: { variant: "secondary", children: "Disabled", disabled: true },
};

// ── Destructive ──────────────────────────────────────────────────────────

export const Destructive: Story = {
  args: {
    variant: "destructive",
    children: "Delete",
  },
};

export const DestructiveSmall: Story = {
  args: { variant: "destructive", size: "sm", children: "Remove" },
};

export const DestructiveLarge: Story = {
  args: { variant: "destructive", size: "lg", children: "Delete Account" },
};

export const DestructiveDisabled: Story = {
  args: { variant: "destructive", children: "Delete", disabled: true },
};

// ── With Icons ───────────────────────────────────────────────────────────

export const WithLeadingIcon: Story = {
  args: {
    variant: "primary",
    children: "Add Item",
    leadingIcon: <PlusIcon />,
  },
};

export const WithTrailingIcon: Story = {
  args: {
    variant: "primary",
    children: "Continue",
    trailingIcon: <ChevronRight />,
  },
};

export const WithBothIcons: Story = {
  args: {
    variant: "primary",
    children: "Next Step",
    leadingIcon: <PlusIcon />,
    trailingIcon: <ChevronRight />,
  },
};

export const DestructiveWithIcon: Story = {
  args: {
    variant: "destructive",
    children: "Delete",
    leadingIcon: <TrashIcon />,
  },
};

// ── All Variants Gallery ─────────────────────────────────────────────────

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ margin: "0 0 12px", fontFamily: "Inter, sans-serif", fontSize: 14, color: "#666" }}>Primary</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" size="md">Medium</Button>
          <Button variant="primary" size="lg">Large</Button>
          <Button variant="primary" size="md" disabled>Disabled</Button>
          <Button variant="primary" size="md" leadingIcon={<PlusIcon />}>With Icon</Button>
        </div>
      </div>
      <div>
        <h3 style={{ margin: "0 0 12px", fontFamily: "Inter, sans-serif", fontSize: 14, color: "#666" }}>Secondary</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Button variant="secondary" size="sm">Small</Button>
          <Button variant="secondary" size="md">Medium</Button>
          <Button variant="secondary" size="lg">Large</Button>
          <Button variant="secondary" size="md" disabled>Disabled</Button>
          <Button variant="secondary" size="md" trailingIcon={<ChevronRight />}>With Icon</Button>
        </div>
      </div>
      <div>
        <h3 style={{ margin: "0 0 12px", fontFamily: "Inter, sans-serif", fontSize: 14, color: "#666" }}>Destructive</h3>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Button variant="destructive" size="sm">Small</Button>
          <Button variant="destructive" size="md">Medium</Button>
          <Button variant="destructive" size="lg">Large</Button>
          <Button variant="destructive" size="md" disabled>Disabled</Button>
          <Button variant="destructive" size="md" leadingIcon={<TrashIcon />}>Delete</Button>
        </div>
      </div>
    </div>
  ),
};
