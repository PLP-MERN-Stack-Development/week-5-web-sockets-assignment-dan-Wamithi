import mongoose, { type Document, Schema } from "mongoose"

export interface IReaction {
  emoji: string
  users: mongoose.Types.ObjectId[]
}

export interface IMessage extends Document {
  _id: string
  content: string
  sender: mongoose.Types.ObjectId
  room: mongoose.Types.ObjectId
  type: "text" | "image" | "file" | "system"
  fileName?: string
  fileUrl?: string
  fileSize?: number
  reactions: IReaction[]
  isEdited: boolean
  editedAt?: Date
  isDeleted: boolean
  deletedAt?: Date
  replyTo?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const ReactionSchema = new Schema<IReaction>({
  emoji: {
    type: String,
    required: true,
  },
  users: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
})

const MessageSchema = new Schema<IMessage>(
  {
    content: {
      type: String,
      required: [true, "Message content is required"],
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
    },
    fileName: {
      type: String,
      default: null,
    },
    fileUrl: {
      type: String,
      default: null,
    },
    fileSize: {
      type: Number,
      default: null,
    },
    reactions: [ReactionSchema],
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  {
    timestamps: true,
  },
)

// Indexes
MessageSchema.index({ room: 1, createdAt: -1 })
MessageSchema.index({ sender: 1, createdAt: -1 })
MessageSchema.index({ isDeleted: 1 })

export default mongoose.model<IMessage>("Message", MessageSchema)
