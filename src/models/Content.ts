// models/Content.ts
import mongoose, { Document, Model, Types } from 'mongoose';
export type ContentType = 'static' | 'dynamic';

export interface IContent extends Document {
  _id: string;
  title: string;
  views: number;
  thumbnail: Types.ObjectId;
  contentType: ContentType;
  data: string;
  createdAt: Date;
  lastModifiedAt?: Date;
  createdBy: Types.ObjectId;
  tags: string[];
  difficulty?: "easy" | "medium" | "hard";
  description?: string;
  estimatedTime?: number;
  userEngagement: {
    rating?: number;
    views?: number;
    saves?: number;
    shares?: number;
    completions?: number;
  };
  parentId: Types.ObjectId | null;
  isDraft: boolean;
  isTrash: boolean;
  version: number; // The versioning field
  institutionId?: Types.ObjectId; // For B2B model
}
const defaultData = `'{\"ROOT\":{\"type\":{\"resolvedName\":\"renderCanvas\"},\"isCanvas\":true,\"props\":{\"gap\":8,\"padding\":16},\"displayName\":\"Canvas\",\"custom\":{},\"hidden\":false,\"nodes\":[],\"linkedNodes\":{}}}'
`
const ContentSchema = new mongoose.Schema<IContent>({
  title: { type: String, required: true },
  views: { type: Number, default: 0 },
  thumbnail: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Media",
    required: true 
  },
  contentType: {
    type: String,
    enum: ['static', 'dynamic'],
    required: true,
    default: 'dynamic' // Default to 'static' for your current needs
  },
  data: {
    type: String,
    required: true,
    default: defaultData
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastModifiedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book', // Points to the parent Book document
    default: null // null means it's in the root directory for the user
  },
  tags: {
    type: [String],
    default: []
  },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    default: "easy"
  },
  description: { type: String },
  estimatedTime: { type: Number, default: 0 },
  userEngagement: {
    rating: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    saves: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    completions: { type: Number, default: 0 }
  },
  isDraft: { type: Boolean, default: true },
  isTrash: { type: Boolean, default: false },
  version: {
    type: Number,
    default: 1
  },
  institutionId: { // This links to your new Institution model
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Institution',
    required: false // Optional, for content not tied to an institution
  },
});

const Content: Model<IContent> = 
  mongoose.models.Content || 
  mongoose.model('Content', ContentSchema);

export default Content;
