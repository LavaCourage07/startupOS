/**
 * OS.5: Acrylic Material System Types
 */

export type AcrylicVariant = 'standard' | 'subtle' | 'strong';

export interface AcrylicPanelProps {
  children: React.ReactNode;
  variant?: AcrylicVariant;
  className?: string;
}

export interface AcrylicDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  variant?: AcrylicVariant;
  size?: 'sm' | 'md' | 'lg';
  closeOnEsc?: boolean;
  closeOnOverlay?: boolean;
  /**
   * 窗口模式：
   * - modal: 模态窗口，有全屏遮罩层
   * - nonModal: 非模态窗口，无遮罩层，支持多窗口同时打开
   * @default 'nonModal'
   */
  mode?: 'modal' | 'nonModal';
}
