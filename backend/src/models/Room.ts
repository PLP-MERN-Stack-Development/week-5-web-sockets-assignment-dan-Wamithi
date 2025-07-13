import mongoose, { type Document, Schema } from "mongoose"

export interface IRoom extends Document {
  _id: string
  name: string
  description?: string
  type: "public" | "private" | "direct"
  participants: mongoose.Types.ObjectId[]
  admins: mongoose.Types.ObjectId[]
  owner: mongoose.Types.ObjectId
  avatar?: string
  isActive: boolean
  lastMessage?: mongoose.Types.ObjectId
  lastActivity: Date
  settings: {
    allowFileSharing: boolean
    allowReactions: boolean
    maxParticipants: number
    isEncrypted: boolean
  }
  createdAt: Date
  updatedAt: Date
}

const RoomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: [true, "Room name is required"],
      trim: true,
      maxlength: [100, "Room name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: null,
    },
    type: {
      type: String,
      enum: ["public", "private", "direct"],
      default: "public",
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    settings: {
      allowFileSharing: {
        type: Boolean,
        default: true,
      },
      allowReactions: {
        type: Boolean,
        default: true,
      },
      maxParticipants: {
        type: Number,
        default: 100,
      },
      isEncrypted: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
RoomSchema.index({ type: 1, isActive: 1 })
RoomSchema.index({ participants: 1 })
RoomSchema.index({ owner: 1 })
RoomSchema.index({ lastActivity: -1 })

export default mongoose.model<IRoom>("Room", RoomSchema)
